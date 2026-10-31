import { validatePuzzle } from './validatePuzzle';
import { isSolved } from './isSolved';
import type { GoalMode, Move, MoveMode, PuzzleState, Rules } from './types';

export type SolverStrategy = 'auto' | 'bfs' | 'idastar' | 'wastar';

export interface SolveProgress {
  phase: string;
  statesExplored: number;
  elapsedMs: number;
  /** Aktuelle Tiefen-/Kostenschranke (nur IDA*). */
  depth?: number;
}

export interface SolveOptions {
  rules: Rules;
  strategy?: SolverStrategy;
  /** Obergrenze für gespeicherte/untersuchte Zustände (Speichergrenze). */
  maxStates?: number;
  maxTimeMs?: number;
  /** Gewicht des gewichteten A* (nicht optimal). */
  weight?: number;
  onProgress?: (p: SolveProgress) => void;
  shouldCancel?: () => boolean;
}

export interface SolveStats {
  statesExplored: number;
  elapsedMs: number;
  algorithm: string;
}

export type LimitReason = 'states' | 'time' | 'cancelled';

export type SolveResult =
  | { status: 'solved'; moves: Move[]; /** true nur bei BFS/IDA*: kürzeste Lösung garantiert */ optimal: boolean; stats: SolveStats }
  | { status: 'unsolvable'; stats: SolveStats }
  | { status: 'limit'; reason: LimitReason; stats: SolveStats }
  | { status: 'invalid'; message: string; stats: SolveStats };

// ---------------------------------------------------------------------------
// Interne, flache Darstellung: Uint8Array(n * W), je Röhrchen W Plätze von unten nach oben,
// Wert = Farbe + 1, 0 = leer.
// ---------------------------------------------------------------------------

interface Ctx {
  n: number;
  W: number;
  caps: Uint8Array;
  mode: MoveMode;
  goal: GoalMode;
  scratch: Uint8Array;
}

function makeCtx(p: PuzzleState, rules: Rules): { ctx: Ctx; start: Uint8Array } {
  const n = p.tubes.length;
  const W = Math.max(...p.tubes.map((t) => t.capacity));
  const caps = new Uint8Array(n);
  const start = new Uint8Array(n * W);
  p.tubes.forEach((t, i) => {
    caps[i] = t.capacity;
    t.balls.forEach((b, k) => (start[i * W + k] = b + 1));
  });
  return { ctx: { n, W, caps, mode: rules.mode, goal: rules.goal, scratch: new Uint8Array(256) }, start };
}

function computeLens(s: Uint8Array, ctx: Ctx, lens: Int32Array): void {
  for (let t = 0; t < ctx.n; t++) {
    const base = t * ctx.W;
    const cap = ctx.caps[t];
    let l = 0;
    while (l < cap && s[base + l] !== 0) l++;
    lens[t] = l;
  }
}

function lenOf(s: Uint8Array, t: number, ctx: Ctx): number {
  let l = 0;
  const base = t * ctx.W;
  while (l < ctx.caps[t] && s[base + l] !== 0) l++;
  return l;
}

function keyOf(s: Uint8Array, ctx: Ctx, tmp: string[]): string {
  for (let t = 0; t < ctx.n; t++) {
    const base = t * ctx.W;
    let str = String.fromCharCode(ctx.caps[t]);
    for (let i = 0; i < ctx.caps[t]; i++) {
      const v = s[base + i];
      if (v === 0) break;
      str += String.fromCharCode(v);
    }
    tmp[t] = str;
  }
  tmp.sort();
  return tmp.join('\u0000');
}

function isGoal(s: Uint8Array, ctx: Ctx): boolean {
  const seen = ctx.scratch;
  if (ctx.goal === 'complete') seen.fill(0);
  for (let t = 0; t < ctx.n; t++) {
    const base = t * ctx.W;
    const c = s[base];
    if (c === 0) continue;
    for (let i = 1; i < ctx.caps[t]; i++) {
      const v = s[base + i];
      if (v === 0) break;
      if (v !== c) return false;
    }
    if (ctx.goal === 'complete') {
      if (seen[c] !== 0) return false;
      seen[c] = 1;
    }
  }
  return true;
}

/**
 * Zulässige (admissible) und konsistente Heuristik: untere Schranke für die Zahl der Züge.
 * Pro Röhrchen muss jede Kugel oberhalb des einfarbigen Bodenblocks mindestens einmal bewegt werden
 * (sonst bliebe das Röhrchen gemischt). Einzelkugel-Modus: zählt Kugeln; Blockmodus: zählt Farbblöcke,
 * weil ein Zug nur einen Block aus einem Röhrchen bewegt. Gilt auch für die strengere Zielbedingung.
 */
function heuristic(s: Uint8Array, ctx: Ctx): number {
  let h = 0;
  for (let t = 0; t < ctx.n; t++) {
    const base = t * ctx.W;
    const c = s[base];
    if (c === 0) continue;
    let l = 1;
    const cap = ctx.caps[t];
    while (l < cap && s[base + l] !== 0) l++;
    let r = 1;
    while (r < l && s[base + r] === c) r++;
    if (r === l) continue;
    if (ctx.mode === 'single') {
      h += l - r;
    } else {
      let runs = 1;
      for (let i = r + 1; i < l; i++) if (s[base + i] !== s[base + i - 1]) runs++;
      h += runs;
    }
  }
  return h;
}

/** Nicht zulässige Zusatzbewertung für das gewichtete A*: Farben, die auf mehrere Röhrchen verteilt sind. */
function splitPenalty(s: Uint8Array, ctx: Ctx): number {
  const tubesWithColor = new Uint8Array(256);
  for (let t = 0; t < ctx.n; t++) {
    const base = t * ctx.W;
    const seenHere = new Set<number>();
    for (let i = 0; i < ctx.caps[t]; i++) {
      const v = s[base + i];
      if (v === 0) break;
      if (!seenHere.has(v)) {
        seenHere.add(v);
        tubesWithColor[v]++;
      }
    }
  }
  let p = 0;
  for (let c = 1; c < 256; c++) if (tubesWithColor[c] > 1) p += tubesWithColor[c] - 1;
  return p;
}

/** Erzeugt alle legalen Folgezustände. Callback gibt true zurück, um abzubrechen. */
function expandState(
  s: Uint8Array,
  ctx: Ctx,
  lens: Int32Array,
  cb: (child: Uint8Array, from: number, to: number, count: number, color: number) => boolean | void,
): void {
  const { n, W, caps, mode } = ctx;
  for (let from = 0; from < n; from++) {
    const lf = lens[from];
    if (lf === 0) continue;
    const color = s[from * W + lf - 1];
    let run = 1;
    while (run < lf && s[from * W + lf - 1 - run] === color) run++;
    for (let to = 0; to < n; to++) {
      if (to === from) continue;
      const lt = lens[to];
      const free = caps[to] - lt;
      if (free <= 0) continue;
      if (lt > 0 && s[to * W + lt - 1] !== color) continue;
      const count = mode === 'single' ? 1 : Math.min(run, free);
      // Umlagern eines kompletten einfarbigen Röhrchens in ein leeres gleich großes ergibt
      // denselben symmetrisch reduzierten Zustand und wird deshalb gar nicht erst erzeugt.
      if (lt === 0 && run === lf && count === lf && caps[from] === caps[to]) continue;
      const child = s.slice();
      for (let k = 0; k < count; k++) {
        child[from * W + lf - 1 - k] = 0;
        child[to * W + lt + k] = color;
      }
      if (cb(child, from, to, count, color - 1) === true) return;
    }
  }
}

// ---------------------------------------------------------------------------
// Budget / Abbruch
// ---------------------------------------------------------------------------

class LimitSignal extends Error {
  constructor(public reason: LimitReason) {
    super(reason);
  }
}

interface Budget {
  /** Wirft LimitSignal, wenn eine Grenze erreicht ist. `size` = aktuell gehaltene Zustände. */
  tick(expanded: number, size: number, depth?: number): void;
}

function makeBudget(
  opts: SolveOptions,
  phase: string,
  baseExplored: number,
  startedAt: number,
  maxStates: number,
  deadline: number,
): Budget {
  let lastProgress = 0;
  return {
    tick(expanded, size, depth) {
      const now = Date.now();
      if (size > maxStates) throw new LimitSignal('states');
      if (now > deadline) throw new LimitSignal('time');
      if (opts.shouldCancel?.()) throw new LimitSignal('cancelled');
      if (opts.onProgress && now - lastProgress >= 200) {
        lastProgress = now;
        opts.onProgress({ phase, statesExplored: baseExplored + expanded, elapsedMs: now - startedAt, depth });
      }
    },
  };
}

type Phase =
  | { kind: 'solved'; moves: Move[]; explored: number }
  | { kind: 'exhausted'; explored: number }
  | { kind: 'limit'; reason: LimitReason; explored: number };

// ---------------------------------------------------------------------------
// Pfad-Rekonstruktion
// ---------------------------------------------------------------------------

interface Nodes {
  states: Uint8Array[];
  parent: number[];
  mv: number[];
  g: number[];
}

function pushNode(nodes: Nodes, s: Uint8Array, parent: number, mv: number, g: number): number {
  nodes.states.push(s);
  nodes.parent.push(parent);
  nodes.mv.push(mv);
  nodes.g.push(g);
  return nodes.states.length - 1;
}

function reconstruct(nodes: Nodes, idx: number, ctx: Ctx): Move[] {
  const out: Move[] = [];
  while (nodes.parent[idx] >= 0) {
    const p = nodes.parent[idx];
    const m = nodes.mv[idx];
    const from = m & 255;
    const to = (m >> 8) & 255;
    const count = m >> 16;
    const ps = nodes.states[p];
    const color = ps[from * ctx.W + lenOf(ps, from, ctx) - 1] - 1;
    out.push({ from, to, color, count });
    idx = p;
  }
  return out.reverse();
}

// ---------------------------------------------------------------------------
// BFS: vollständig und optimal (kürzeste Zugzahl)
// ---------------------------------------------------------------------------

function runBfs(start: Uint8Array, ctx: Ctx, budget: Budget): Phase {
  const tmp: string[] = new Array<string>(ctx.n);
  const nodes: Nodes = { states: [], parent: [], mv: [], g: [] };
  pushNode(nodes, start, -1, 0, 0);
  const visited = new Set<string>([keyOf(start, ctx, tmp)]);
  const lens = new Int32Array(ctx.n);
  let head = 0;
  try {
    while (head < nodes.states.length) {
      if ((head & 255) === 0) budget.tick(head, visited.size);
      const s = nodes.states[head];
      computeLens(s, ctx, lens);
      let found = -1;
      expandState(s, ctx, lens, (child, from, to, count) => {
        const key = keyOf(child, ctx, tmp);
        if (visited.has(key)) return;
        visited.add(key);
        const idx = pushNode(nodes, child, head, from | (to << 8) | (count << 16), nodes.g[head] + 1);
        if (isGoal(child, ctx)) {
          found = idx;
          return true;
        }
      });
      if (found >= 0) return { kind: 'solved', moves: reconstruct(nodes, found, ctx), explored: head };
      head++;
    }
    return { kind: 'exhausted', explored: head };
  } catch (e) {
    if (e instanceof LimitSignal) return { kind: 'limit', reason: e.reason, explored: head };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Gewichtetes A*: findet schnell eine Lösung, Optimalität NICHT garantiert
// ---------------------------------------------------------------------------

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(k: number, v: number): void {
    const keys = this.keys;
    const vals = this.vals;
    let i = keys.length;
    keys.push(k);
    vals.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0];
    const lastK = keys.pop() as number;
    const lastV = vals.pop() as number;
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= lastK) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = lastK;
      vals[i] = lastV;
    }
    return top;
  }
}

function runWeightedAstar(start: Uint8Array, ctx: Ctx, budget: Budget, weight: number): Phase {
  const tmp: string[] = new Array<string>(ctx.n);
  const nodes: Nodes = { states: [], parent: [], mv: [], g: [] };
  const dead: number[] = [];
  const evalH = (s: Uint8Array) => heuristic(s, ctx) + 0.5 * splitPenalty(s, ctx);
  const root = pushNode(nodes, start, -1, 0, 0);
  dead.push(0);
  const bestIdx = new Map<string, number>([[keyOf(start, ctx, tmp), root]]);
  const heap = new MinHeap();
  heap.push(weight * evalH(start), root);
  const lens = new Int32Array(ctx.n);
  let expanded = 0;
  try {
    while (heap.size > 0) {
      const idx = heap.pop();
      if (dead[idx] === 1) continue;
      if ((expanded & 255) === 0) budget.tick(expanded, nodes.states.length);
      expanded++;
      const s = nodes.states[idx];
      computeLens(s, ctx, lens);
      const gChild = nodes.g[idx] + 1;
      let found = -1;
      expandState(s, ctx, lens, (child, from, to, count) => {
        const key = keyOf(child, ctx, tmp);
        const prev = bestIdx.get(key);
        if (prev !== undefined) {
          if (nodes.g[prev] <= gChild) return;
          dead[prev] = 1;
        }
        const cidx = pushNode(nodes, child, idx, from | (to << 8) | (count << 16), gChild);
        dead.push(0);
        bestIdx.set(key, cidx);
        if (isGoal(child, ctx)) {
          found = cidx;
          return true;
        }
        const h = evalH(child);
        heap.push((gChild + weight * h) * 1000 + h, cidx);
      });
      if (found >= 0) return { kind: 'solved', moves: reconstruct(nodes, found, ctx), explored: expanded };
    }
    return { kind: 'exhausted', explored: expanded };
  } catch (e) {
    if (e instanceof LimitSignal) return { kind: 'limit', reason: e.reason, explored: expanded };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// IDA*: speicherschonend, optimal (zulässige Heuristik)
// ---------------------------------------------------------------------------

function runIdaStar(start: Uint8Array, ctx: Ctx, budget: Budget, maxTable: number): Phase {
  const tmp: string[] = new Array<string>(ctx.n);
  const path: Move[] = [];
  const seen = new Map<string, number>();
  let expanded = 0;
  let bound = heuristic(start, ctx);

  const dfs = (s: Uint8Array, g: number): number => {
    const h = heuristic(s, ctx);
    const f = g + h;
    if (f > bound) return f;
    if (h === 0 && isGoal(s, ctx)) return -1;
    if ((expanded & 255) === 0) budget.tick(expanded, expanded, bound);
    expanded++;
    const lens = new Int32Array(ctx.n);
    computeLens(s, ctx, lens);
    const kids: { s: Uint8Array; from: number; to: number; count: number; color: number; h: number }[] = [];
    expandState(s, ctx, lens, (child, from, to, count, color) => {
      const key = keyOf(child, ctx, tmp);
      const prev = seen.get(key);
      if (prev !== undefined && prev <= g + 1) return;
      if (seen.size >= maxTable) seen.clear();
      seen.set(key, g + 1);
      kids.push({ s: child, from, to, count, color, h: heuristic(child, ctx) });
    });
    kids.sort((a, b) => a.h - b.h);
    let min = Infinity;
    for (const k of kids) {
      path.push({ from: k.from, to: k.to, color: k.color, count: k.count });
      const r = dfs(k.s, g + 1);
      if (r === -1) return -1;
      path.pop();
      if (r < min) min = r;
    }
    return min;
  };

  try {
    for (;;) {
      seen.clear();
      path.length = 0;
      const r = dfs(start, 0);
      if (r === -1) return { kind: 'solved', moves: path.slice(), explored: expanded };
      if (r === Infinity) return { kind: 'exhausted', explored: expanded };
      bound = r;
    }
  } catch (e) {
    if (e instanceof LimitSignal) return { kind: 'limit', reason: e.reason, explored: expanded };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export function solvePuzzle(puzzle: PuzzleState, options: SolveOptions): SolveResult {
  const startedAt = Date.now();
  const strategy: SolverStrategy = options.strategy ?? 'auto';
  const maxStates = options.maxStates ?? 400_000;
  const maxTimeMs = options.maxTimeMs ?? 30_000;
  const weight = options.weight ?? 3;
  let explored = 0;
  const stats = (algorithm: string): SolveStats => ({ statesExplored: explored, elapsedMs: Date.now() - startedAt, algorithm });

  const validation = validatePuzzle(puzzle, { rules: options.rules });
  if (!validation.valid) {
    const first = validation.issues.find((i) => i.severity === 'error');
    return { status: 'invalid', message: first?.message ?? 'Ungültiger Zustand.', stats: stats('Validierung') };
  }
  if (isSolved(puzzle, options.rules.goal)) {
    return { status: 'solved', moves: [], optimal: true, stats: stats('bereits gelöst') };
  }
  if (options.shouldCancel?.()) return { status: 'limit', reason: 'cancelled', stats: stats('abgebrochen') };

  const { ctx, start } = makeCtx(puzzle, options.rules);
  const deadline = startedAt + maxTimeMs;

  const finish = (phase: Phase, name: string, optimal: boolean): SolveResult | { limit: LimitReason } | null => {
    explored += phase.explored;
    if (phase.kind === 'solved') return { status: 'solved', moves: phase.moves, optimal, stats: stats(name) };
    if (phase.kind === 'exhausted') return { status: 'unsolvable', stats: stats(name) };
    return { limit: phase.reason };
  };
  const limitResult = (reason: LimitReason, name: string): SolveResult => ({ status: 'limit', reason, stats: stats(name) });

  if (strategy === 'bfs') {
    const r = finish(runBfs(start, ctx, makeBudget(options, 'Breitensuche', explored, startedAt, maxStates, deadline)), 'Breitensuche (BFS)', true);
    return r && 'status' in r ? r : limitResult((r as { limit: LimitReason }).limit, 'Breitensuche (BFS)');
  }
  if (strategy === 'idastar') {
    const r = finish(runIdaStar(start, ctx, makeBudget(options, 'IDA*', explored, startedAt, maxStates, deadline), maxStates), 'IDA*', true);
    return r && 'status' in r ? r : limitResult((r as { limit: LimitReason }).limit, 'IDA*');
  }
  if (strategy === 'wastar') {
    const name = `Gewichtetes A* (w=${weight})`;
    const r = finish(runWeightedAstar(start, ctx, makeBudget(options, 'A*', explored, startedAt, maxStates, deadline), weight), name, false);
    return r && 'status' in r ? r : limitResult((r as { limit: LimitReason }).limit, name);
  }

  // auto: 1) BFS (klein, optimal, kann Unlösbarkeit beweisen) → 2) gewichtetes A* → 3) IDA*
  const bfsStates = Math.min(maxStates, 120_000);
  const bfsDeadline = startedAt + Math.max(500, Math.floor(maxTimeMs * 0.2));
  let r = finish(runBfs(start, ctx, makeBudget(options, 'Breitensuche', explored, startedAt, bfsStates, bfsDeadline)), 'Breitensuche (BFS)', true);
  if (r && 'status' in r) return r;
  if ((r as { limit: LimitReason }).limit === 'cancelled') return limitResult('cancelled', 'Breitensuche (BFS)');

  const waDeadline = Math.min(deadline, Date.now() + Math.floor((deadline - Date.now()) * 0.7));
  const waName = `Gewichtetes A* (w=${weight})`;
  r = finish(runWeightedAstar(start, ctx, makeBudget(options, 'Gewichtetes A*', explored, startedAt, maxStates, waDeadline), weight), waName, false);
  if (r && 'status' in r) return r;
  const waLimit = (r as { limit: LimitReason }).limit;
  if (waLimit === 'cancelled' || Date.now() >= deadline) return limitResult(waLimit === 'cancelled' ? 'cancelled' : 'time', waName);

  r = finish(runIdaStar(start, ctx, makeBudget(options, 'IDA*', explored, startedAt, maxStates, deadline), maxStates), 'IDA*', true);
  if (r && 'status' in r) return r;
  return limitResult((r as { limit: LimitReason }).limit, 'IDA*');
}
