import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import type { LanePlacementRecord } from './composeLaneLinks.ts'

interface Cursor {
  ops: Uint32Array
  k: number
  /** anchor bp left in the op at `k` */
  left: number
  /** lane bp the cursor sits at */
  lane: number
  dir: number
}

function opAt(c: Cursor) {
  const packed = c.ops[c.k]!
  return { len: packed >>> 4, op: packed & 0xf }
}

function advanceLane(c: Cursor, bp: number) {
  c.lane += bp * c.dir
}

function consumesLane(op: number) {
  return op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X
}

function consumesAnchor(op: number) {
  return consumesLane(op) || op === CIGAR_D || op === CIGAR_N
}

/** Walks from the feature's own coordinates, not the placement's. */
function cursorAt(record: LanePlacementRecord, ops: Uint32Array) {
  const mate = record.feature.get('mate') as
    | { start: number; end: number }
    | undefined
  if (!mate) {
    return undefined
  }
  const c: Cursor = {
    ops,
    k: 0,
    left: ops[0]! >>> 4,
    lane: record.strand === -1 ? mate.end : mate.start,
    dir: record.strand,
  }
  return c
}

function seek(c: Cursor, anchorFrom: number, anchorTarget: number) {
  let at = anchorFrom
  while (c.k < c.ops.length && at < anchorTarget) {
    const { len, op } = opAt(c)
    if (op === CIGAR_I) {
      advanceLane(c, len)
      c.k++
      c.left = c.k < c.ops.length ? opAt(c).len : 0
      continue
    }
    const step = Math.min(c.left, anchorTarget - at)
    if (consumesLane(op)) {
      advanceLane(c, step)
    }
    at += step
    c.left -= step
    if (c.left === 0) {
      c.k++
      c.left = c.k < c.ops.length ? opAt(c).len : 0
    }
  }
  return at
}

function push(out: number[], len: number, op: number) {
  if (len <= 0) {
    return
  }
  const last = out.length - 1
  if (last >= 0 && (out[last]! & 0xf) === op) {
    out[last] = (((out[last]! >>> 4) + len) << 4) | op
  } else {
    out.push((len << 4) | op)
  }
}

function hasRun(ops: Uint32Array) {
  for (let k = 0; k < ops.length; k++) {
    if ((ops[k]! & 0xf) === CIGAR_RUN) {
      return true
    }
  }
  return false
}

/** per record, where its walk stopped; a stretch opening earlier rebuilds */
export type ComposeCursors = Map<LanePlacementRecord, RecordState>

interface RecordState {
  /** absent where the record states no usable alignment */
  cursor?: Cursor
  at: number
}

function stateFor(
  record: LanePlacementRecord,
  anchorStart: number,
  cursors: ComposeCursors | undefined,
): RecordState {
  const held = cursors?.get(record)
  if (held) {
    if (!held.cursor) {
      return held
    }
    if (held.at <= anchorStart) {
      held.at = seek(held.cursor, held.at, anchorStart)
      return held
    }
  }
  const { ops } = record
  const usable = ops && ops.length > 0 && !hasRun(ops)
  const cursor = usable ? cursorAt(record, ops) : undefined
  const state: RecordState = {
    cursor,
    at: cursor ? seek(cursor, record.feature.get('start'), anchorStart) : 0,
  }
  cursors?.set(record, state)
  return state
}

export interface ComposedAlignment {
  ops: Uint32Array
  upperStart: number
  upperEnd: number
  lowerStart: number
  lowerEnd: number
}

/**
 * Undefined where either side carries a `CIGAR_RUN`. Two mismatches compose to
 * `M`, since the file never says they share an alternative.
 */
export function composeAlignmentOps(
  upper: LanePlacementRecord,
  lower: LanePlacementRecord,
  anchorStart: number,
  anchorEnd: number,
  cursors?: ComposeCursors,
): ComposedAlignment | undefined {
  const uState = stateFor(upper, anchorStart, cursors)
  const lState = stateFor(lower, anchorStart, cursors)
  const u = uState.cursor
  const l = lState.cursor
  if (!u || !l) {
    return undefined
  }
  const uOps = u.ops
  const lOps = l.ops
  const upperFrom = u.lane
  const lowerFrom = l.lane

  const out: number[] = []
  let at = anchorStart
  while (at < anchorEnd && u.k < uOps.length && l.k < lOps.length) {
    const uo = opAt(u)
    const lo = opAt(l)
    if (uo.op === CIGAR_I && lo.op === CIGAR_I) {
      const shared = Math.min(uo.len, lo.len)
      push(out, shared, CIGAR_M)
      push(out, uo.len - shared, CIGAR_D)
      push(out, lo.len - shared, CIGAR_I)
      advanceLane(u, uo.len)
      advanceLane(l, lo.len)
      u.k++
      u.left = u.k < uOps.length ? opAt(u).len : 0
      l.k++
      l.left = l.k < lOps.length ? opAt(l).len : 0
      continue
    }
    if (uo.op === CIGAR_I) {
      push(out, uo.len, CIGAR_D)
      advanceLane(u, uo.len)
      u.k++
      u.left = u.k < uOps.length ? opAt(u).len : 0
      continue
    }
    if (lo.op === CIGAR_I) {
      push(out, lo.len, CIGAR_I)
      advanceLane(l, lo.len)
      l.k++
      l.left = l.k < lOps.length ? opAt(l).len : 0
      continue
    }
    if (!consumesAnchor(uo.op) || !consumesAnchor(lo.op)) {
      return undefined
    }
    const step = Math.min(u.left, l.left, anchorEnd - at)
    const uLane = consumesLane(uo.op)
    const lLane = consumesLane(lo.op)
    if (uLane && lLane) {
      const differs = (uo.op === CIGAR_X) !== (lo.op === CIGAR_X)
      const both = uo.op === CIGAR_X && lo.op === CIGAR_X
      push(out, step, differs ? CIGAR_X : both ? CIGAR_M : CIGAR_EQ)
      advanceLane(u, step)
      advanceLane(l, step)
    } else if (uLane) {
      push(out, step, CIGAR_D)
      advanceLane(u, step)
    } else if (lLane) {
      push(out, step, CIGAR_I)
      advanceLane(l, step)
    }
    at += step
    u.left -= step
    l.left -= step
    if (u.left === 0) {
      u.k++
      u.left = u.k < uOps.length ? opAt(u).len : 0
    }
    if (l.left === 0) {
      l.k++
      l.left = l.k < lOps.length ? opAt(l).len : 0
    }
  }
  uState.at = at
  lState.at = at
  if (out.length === 0) {
    return undefined
  }
  if (upper.strand === -1) {
    out.reverse()
  }
  return {
    ops: Uint32Array.from(out),
    upperStart: Math.min(upperFrom, u.lane),
    upperEnd: Math.max(upperFrom, u.lane),
    lowerStart: Math.min(lowerFrom, l.lane),
    lowerEnd: Math.max(lowerFrom, l.lane),
  }
}
