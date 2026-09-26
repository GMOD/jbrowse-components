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
  /** the lane coordinate the anchor cursor currently sits at */
  lane: number
  dir: number
}

/** anchor bp, lane bp and kind of the op a cursor sits on */
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

/**
 * The anchor and lane coordinates the record's ops walk from, which are the
 * feature's own and not the placement's — `addAlignmentDetail` walks a direct
 * record from exactly these, so a composed gutter and a direct one read the
 * same alignment the same way.
 */
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

/**
 * Run the cursor forward to `anchorTarget`, an insertion at a time, without
 * emitting: the lane bp an insertion carries before the composed stretch opens
 * belongs to neither composed lane.
 */
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

/**
 * Where each record's walk stopped, so the next stretch of the same record
 * resumes instead of re-walking its ops from the start. One wide record against
 * 20,000 split ones took 63 s without it, because every pair sought forward
 * through the wide record's whole CIGAR; the sweep hands out stretches in anchor
 * order, so resuming makes that one pass. A stretch that opens BEFORE where the
 * cursor stopped rebuilds, which is correct and no slower than not caching.
 */
/**
 * One entry per record, holding both answers that cost a pass over its ops: the
 * `CIGAR_RUN` test, and how far the walk has got. Without it a record is
 * re-tested and re-sought for every stretch it takes part in, so one lane left
 * whole against another cut into 10,000 runs walked its CIGAR 20,000 times.
 * The sweep hands out stretches in anchor order, so resuming makes that one
 * pass; a stretch opening BEFORE where the cursor stopped rebuilds, which is
 * correct and no slower than not caching at all.
 */
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
  const ops = record.feature.get('alignmentOps') as Uint32Array | undefined
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
 * The alignment between two mate lanes that a star of pairwise alignments
 * never states, composed from the two alignments it does state: over the
 * anchor stretch both records cover, a base each lane places is a match
 * between them, a base only one lane places is that lane's own insertion, and
 * a base one lane calls a mismatch while the other calls it a match is a
 * mismatch between the two lanes. Where BOTH call it a mismatch the file has
 * not said whether they carry the same alternative, so the composed op is `M`
 * — aligned, unstated — and no mismatch mark draws.
 *
 * Nothing here aligns anything: every op comes from an op the file already
 * carries, which is what lets a composed gutter draw the same detail a direct
 * pair draws. The affine projection it replaces is wrong by up to the largest
 * indel inside the stretch, so a composed gutter used to slide against its
 * neighbours by exactly the structure a reader came to see.
 *
 * A coarse row folds runs the two sides cannot be stepped through together, so
 * a `CIGAR_RUN` on either side declines the composition and leaves the caller
 * its affine projection — the coarse tier draws no per-base detail anyway.
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
