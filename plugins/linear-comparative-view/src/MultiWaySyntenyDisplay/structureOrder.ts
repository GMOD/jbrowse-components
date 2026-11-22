import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import { getMate, isArrayRecord } from '../syntenyMate.ts'
import { groupFeatures, laneIndelsOf } from './layoutMultiWay.ts'

import type { AlignmentOpsById } from './alignmentOps.ts'
import type { Feature } from '@jbrowse/core/util'

const BINS = 120

interface AnchorAxis {
  binOf: (refName: string, bp: number) => number
  binEnd: (refName: string, bin: number) => number
  binBp: number
}

function anchorAxis(features: readonly Feature[]): AnchorAxis {
  const extent = new Map<string, [number, number]>()
  for (const f of features) {
    const refName: string = f.get('refName')
    const [lo, hi] = extent.get(refName) ?? [Infinity, -Infinity]
    extent.set(refName, [
      Math.min(lo, f.get('start')),
      Math.max(hi, f.get('end')),
    ])
  }
  const total = [...extent.values()].reduce((n, [lo, hi]) => n + hi - lo, 0)
  const binBp = Math.max(1, total / BINS)
  const offset = new Map<string, number>()
  let at = 0
  for (const [refName, [lo, hi]] of extent) {
    offset.set(refName, at - lo)
    at += hi - lo
  }
  return {
    binBp,
    binOf: (refName, bp) =>
      Math.min(
        BINS - 1,
        Math.max(0, Math.floor((bp + offset.get(refName)!) / binBp)),
      ),
    binEnd: (refName, bin) => (bin + 1) * binBp - offset.get(refName)!,
  }
}

/**
 * A lane's structure against the anchor, in anchor bins: how much of each bin
 * it aligns to forward, then reversed, then how much sequence it carries there
 * that the anchor lacks, in bins' worth, so an insertion weighs what a
 * deletion of its length does. A bin aligned reversed differs from a forward
 * one in two bands, so it weighs twice a deleted bin. The sequence between
 * pieces is the lane header's gap reading (`laneIndelsOf`) on the strand
 * holding most bp of each contig, which need not be the strand the lane is
 * drawn on; an array record pairs no copy, so it aligns nothing and only
 * bounds gaps
 */
export function laneProfiles(
  features: readonly Feature[],
  opsById: AlignmentOpsById,
) {
  const axis = anchorAxis(features)
  const profiles = new Map<string, Float64Array>()
  const contigs = new Map<
    string,
    { lane: string; refName: string; strandBp: number }
  >()
  for (const f of features) {
    const mate = getMate(f)
    if (mate !== undefined) {
      const lane = mate.assemblyName
      const profile = profiles.get(lane) ?? new Float64Array(3 * BINS)
      profiles.set(lane, profile)
      if (!isArrayRecord(f)) {
        const reversed = f.get('strand') === -1
        const contigKey = `${lane}\t${mate.refName}`
        const contig = contigs.get(contigKey) ?? {
          lane,
          refName: mate.refName,
          strandBp: 0,
        }
        contig.strandBp += (reversed ? -1 : 1) * (mate.end - mate.start)
        contigs.set(contigKey, contig)
        const refName: string = f.get('refName')
        const band = reversed ? BINS : 0
        const cover = (from: number, to: number) => {
          for (let bp = from; bp < to;) {
            const bin = axis.binOf(refName, bp)
            const next =
              bin === BINS - 1 ? to : Math.min(to, axis.binEnd(refName, bin))
            const end = Math.max(next, bp + 1)
            profile[band + bin]! += (end - bp) / axis.binBp
            bp = end
          }
        }
        const ops = opsById.get(f.id())
        let bp: number = f.get('start')
        if (!ops) {
          cover(bp, f.get('end'))
        } else {
          for (let k = 0; k < ops.length; k++) {
            const len = ops[k]! >>> 4
            const op = ops[k]! & 0xf
            if (op === CIGAR_RUN) {
              k++
              cover(bp, bp + len)
              bp += len
            } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
              cover(bp, bp + len)
              bp += len
            } else if (op === CIGAR_D || op === CIGAR_N) {
              bp += len
            } else if (op === CIGAR_I) {
              profile[2 * BINS + axis.binOf(refName, bp)]! += len / axis.binBp
            }
          }
        }
      }
    }
  }
  const { changes } = laneIndelsOf(groupFeatures(features))
  for (const { lane, refName, strandBp } of contigs.values()) {
    const profile = profiles.get(lane)!
    for (const change of changes(lane, refName, strandBp < 0)) {
      if (change.kind !== 'inversion' && change.laneBp > 0) {
        profile[
          2 * BINS + axis.binOf(change.anchor.refName, change.anchor.start)
        ]! += change.laneBp / axis.binBp
      }
    }
  }
  for (const profile of profiles.values()) {
    for (let i = 0; i < 2 * BINS; i++) {
      profile[i] = Math.min(1, profile[i]!)
    }
  }
  return profiles
}

// Reading `b`'s forward and reversed bands either way round, so a contig
// assembled against the anchor's direction sits with its collinear peers
function distance(a: Float64Array, b: Float64Array) {
  let same = 0
  let swapped = 0
  for (let i = 0; i < BINS; i++) {
    same += Math.abs(a[i]! - b[i]!) + Math.abs(a[BINS + i]! - b[BINS + i]!)
    swapped += Math.abs(a[i]! - b[BINS + i]!) + Math.abs(a[BINS + i]! - b[i]!)
  }
  let inserted = 0
  for (let i = 2 * BINS; i < 3 * BINS; i++) {
    inserted += Math.abs(a[i]! - b[i]!)
  }
  return Math.min(same, swapped) + inserted
}

/**
 * Lanes chained so each sits beside the most alike one left, starting from the
 * lane most like the anchor itself, then improved by reversing stretches of
 * the chain while that shortens it: a ribbon joins adjacent lanes only, so the
 * order that matters is the chain's
 */
export function structureOrder(profiles: ReadonlyMap<string, Float64Array>) {
  const names = [...profiles.keys()].sort()
  const vectors = names.map(n => profiles.get(n)!)
  const n = names.length
  if (n === 0) {
    return names
  }
  const anchor = new Float64Array(3 * BINS).fill(1, 0, BINS)
  const d = vectors.map(a => vectors.map(b => distance(a, b)))
  const toAnchor = vectors.map(v => distance(v, anchor))
  const left = new Set(names.keys())
  let at = [...left].reduce((best, i) =>
    toAnchor[i]! < toAnchor[best]! ? i : best,
  )
  const chain = [at]
  left.delete(at)
  while (left.size > 0) {
    const from = at
    at = [...left].reduce((best, i) =>
      d[from]![i]! < d[from]![best]! ? i : best,
    )
    chain.push(at)
    left.delete(at)
  }
  const cost = (i: number, j: number) =>
    i < 0 ? toAnchor[chain[j]!]! : d[chain[i]!]![chain[j]!]!
  for (let improved = true, pass = 0; improved && pass < 50; pass++) {
    improved = false
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const before = cost(i - 1, i) + (j + 1 < n ? cost(j, j + 1) : 0)
        const after =
          (i === 0 ? toAnchor[chain[j]!]! : d[chain[i - 1]!]![chain[j]!]!) +
          (j + 1 < n ? d[chain[i]!]![chain[j + 1]!]! : 0)
        if (after + 1e-9 < before) {
          for (let lo = i, hi = j; lo < hi; lo++, hi--) {
            const swap = chain[lo]!
            chain[lo] = chain[hi]!
            chain[hi] = swap
          }
          improved = true
        }
      }
    }
  }
  return chain.map(i => names[i]!)
}
