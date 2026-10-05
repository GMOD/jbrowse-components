import {
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'
import { mergeIntervals } from '@jbrowse/core/util'

import { getMate } from '../syntenyMate.ts'

import type { AlignmentOpsById } from './alignmentOps.ts'
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
  if (!ops) {
    return [{ start: mate.start, end: mate.end }]
  }
  const dir = feature.get('strand') === -1 ? -1 : 1
  let bp = dir === -1 ? mate.end : mate.start
  const out: { start: number; end: number }[] = []
  for (let k = 0; k < ops.length; k++) {
    const len = ops[k]! >>> 4
    const op = ops[k]! & 0xf
    const step =
      op === CIGAR_RUN
        ? ops[++k]! >>> 4
        : op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X || op === CIGAR_I
          ? len
          : 0
    const next = bp + step * dir
    if (op !== CIGAR_I && step > 0) {
      out.push({ start: Math.min(bp, next), end: Math.max(bp, next) })
    }
    bp = next
  }
  return out
}

/**
 * Each lane's stretches, `minBp` or longer, that lie between two of its
 * stretches the anchor matches: the sequence the lane carries at this locus
 * and the anchor does not. Keyed by lane, as the records' mates name it.
 */
export function offAnchorIntervals(
  features: readonly Feature[],
  opsById: AlignmentOpsById,
  minBp = OFF_ANCHOR_MIN_BP,
) {
  const matched = new Map<string, { start: number; end: number }[]>()
  const keyOf = (lane: string, refName: string) => `${lane}\t${refName}`
  for (const feature of features) {
    const mate = getMate(feature)
    if (mate?.assemblyName !== undefined) {
      const key = keyOf(mate.assemblyName, mate.refName)
      const spans = matched.get(key) ?? []
      spans.push(...matchedOnMate(feature, opsById.get(feature.id())))
      matched.set(key, spans)
    }
  }
  const out = new Map<string, LaneInterval[]>()
  for (const [key, spans] of matched) {
    const [lane, refName] = key.split('\t') as [string, string]
    const merged = mergeIntervals(spans, (minBp - 1) / 2)
    for (let i = 1; i < merged.length; i++) {
      const gap = {
        refName,
        start: merged[i - 1]!.end,
        end: merged[i]!.start,
      }
      out.set(lane, [...(out.get(lane) ?? []), gap])
    }
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
