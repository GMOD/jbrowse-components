import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import { getMate } from '../syntenyMate.ts'
import { forEachLaneGap } from './laneGaps.ts'

import type { AlignmentOpsById } from './alignmentOps.ts'
import type { LanePiece } from './laneGaps.ts'
import type { Feature } from '@jbrowse/core/util'

/** A stretch of one lane, in the lane's own bp */
export interface LaneInterval {
  refName: string
  start: number
  end: number
}

// the length a structural allele starts at, as the tutorials' filters read it
export const OFF_ANCHOR_MIN_BP = 50

export const OFF_ANCHOR_COLOR = '#8e3fbf'

function matchedOnMate(feature: Feature, ops: Uint32Array | undefined) {
  const mate = getMate(feature)!
  const orientation = feature.get('strand') === -1 ? -1 : 1
  const refName: string = feature.get('refName')
  const piece = (
    laneFrom: number,
    laneTo: number,
    anchorFrom: number,
    anchorTo: number,
  ): LanePiece => ({
    lane: {
      start: Math.min(laneFrom, laneTo),
      end: Math.max(laneFrom, laneTo),
      orientation,
    },
    anchor: { refName, start: anchorFrom, end: anchorTo },
  })
  if (!ops) {
    return [
      piece(mate.start, mate.end, feature.get('start'), feature.get('end')),
    ]
  }
  let bp = orientation === -1 ? mate.end : mate.start
  let anchor: number = feature.get('start')
  const out: LanePiece[] = []
  for (let k = 0; k < ops.length; k++) {
    const len = ops[k]! >>> 4
    const op = ops[k]! & 0xf
    const run = op === CIGAR_RUN
    const match = op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X
    const step = run ? ops[++k]! >>> 4 : match || op === CIGAR_I ? len : 0
    const anchorStep =
      run || match || op === CIGAR_D || op === CIGAR_N ? len : 0
    const next = bp + step * orientation
    if (op !== CIGAR_I && step > 0) {
      out.push(piece(bp, next, anchor, anchor + anchorStep))
    }
    bp = next
    anchor += anchorStep
  }
  return out
}

/**
 * Each lane's stretches that lie between two of its stretches the anchor
 * matches and outrun the anchor between those two by `minBp` or more: the
 * sequence the lane carries at this locus and the anchor does not, centred in
 * the gap since the alignment does not say where in it the extra lies. Keyed
 * by lane, as the records' mates name it.
 */
export function offAnchorIntervals(
  features: readonly Feature[],
  opsById: AlignmentOpsById,
  minBp = OFF_ANCHOR_MIN_BP,
) {
  const matched = new Map<string, LanePiece[]>()
  const keyOf = (lane: string, refName: string) => `${lane}\t${refName}`
  for (const feature of features) {
    const mate = getMate(feature)
    if (mate?.assemblyName !== undefined) {
      const key = keyOf(mate.assemblyName, mate.refName)
      const pieces = matched.get(key) ?? []
      pieces.push(...matchedOnMate(feature, opsById.get(feature.id())))
      matched.set(key, pieces)
    }
  }
  const out = new Map<string, LaneInterval[]>()
  for (const [key, pieces] of matched) {
    const [lane, refName] = key.split('\t') as [string, string]
    pieces.sort((a, b) => a.lane.start - b.lane.start)
    forEachLaneGap(pieces, (left, _right, laneGap, anchorGap) => {
      const excess =
        anchorGap === undefined ? 0 : laneGap - Math.max(0, anchorGap)
      if (excess >= minBp) {
        const start = left.lane.end + Math.floor((laneGap - excess) / 2)
        out.set(lane, [
          ...(out.get(lane) ?? []),
          { refName, start, end: start + excess },
        ])
      }
    })
  }
  return out
}

/**
 * The parts of [start, end) outside every interval on `refName`, then the
 * parts inside, each as [start, end) pairs
 */
export function splitByIntervals(
  intervals: readonly LaneInterval[] | undefined,
  refName: string,
  start: number,
  end: number,
) {
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  const inside: [number, number][] = []
  const outside: [number, number][] = []
  let at = lo
  const onRef = (intervals ?? [])
    .filter(i => i.refName === refName && i.end > lo && i.start < hi)
    .sort((a, b) => a.start - b.start)
  for (const i of onRef) {
    const s = Math.max(i.start, lo)
    const e = Math.min(i.end, hi)
    if (s > at) {
      outside.push([at, s])
    }
    inside.push([s, e])
    at = Math.max(at, e)
  }
  if (at < hi) {
    outside.push([at, hi])
  }
  return { inside, outside }
}
