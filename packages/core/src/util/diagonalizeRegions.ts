import { cmpStr } from './cmpStr.ts'
import { createProgressReporter } from './progress.ts'
import { checkStopToken } from './stopToken.ts'

import type { StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { Region } from './types/data.ts'

export interface AlignmentData {
  refRefName: string
  queryRefName: string
  refStart: number
  refEnd: number
  queryStart: number
  queryEnd: number
  strand: number
}

export interface DiagonalizationResult {
  newRegions: Region[]
  stats: {
    regionsReordered: number
    regionsReversed: number
  }
}

// Accumulated stats for one (query chrom, reference chrom) pair. `bases` and
// `strandWeightedSum` are sums of integers, so they are exact and independent of
// the order alignments arrive in. The alignments themselves are kept for
// `anchorStats`, which only runs on the pair a query chromosome anchors to.
interface PairStats {
  refName: string
  refIndex: number
  bases: number
  strandWeightedSum: number
  alignments: AlignmentData[]
}

// A strand vote at least this lopsided (80% of aligned bases agreeing) decides
// the reversal by itself. Below that the vote is unreliable: a chromosome
// carrying many inversions splits it near 50/50, and MCScan `strand` is the
// product of two gene strands rather than a block orientation. The ref-vs-query
// position covariance then decides instead, which is the question reversal is
// actually trying to answer (does the panel read monotonically along the
// reference).
const decisiveStrandFraction = 0.6

// Position along the anchor reference chromosome, and whether the query
// chromosome should be displayed reversed.
//
// Summing in a fixed intra-pair order is what makes the result deterministic:
// the synteny worker emits alignments in nondeterministic order (features from
// concurrently-resolved blocks are concatenated by arrival, not position) and
// float addition is non-associative, so a varying order would perturb these sums
// in their low bits and could flip the query-chromosome ordering on a near-tie.
// Only intra-pair order matters, since every sum here is over one pair.
function anchorStats({ alignments, bases, strandWeightedSum }: PairStats) {
  alignments.sort(
    (a, b) =>
      a.refStart - b.refStart ||
      a.queryStart - b.queryStart ||
      a.refEnd - b.refEnd ||
      a.queryEnd - b.queryEnd,
  )

  // x-axis (reference) length weights everything: consistent weighting for
  // x-axis position and base count, matching the original jmonlong R
  // implementation
  let refPosSum = 0
  let queryPosSum = 0
  for (const aln of alignments) {
    const alnLength = aln.refEnd - aln.refStart
    refPosSum += ((aln.refStart + aln.refEnd) / 2) * alnLength
    queryPosSum += ((aln.queryStart + aln.queryEnd) / 2) * alnLength
  }
  const refMean = refPosSum / bases
  const queryMean = queryPosSum / bases

  // length-weighted covariance of the two axes' positions, centered on the means
  // so it stays precise at genomic magnitudes. Negative means the query runs
  // antiparallel to the reference.
  let covariance = 0
  for (const aln of alignments) {
    covariance +=
      (aln.refEnd - aln.refStart) *
      ((aln.refStart + aln.refEnd) / 2 - refMean) *
      ((aln.queryStart + aln.queryEnd) / 2 - queryMean)
  }

  const strandFraction = strandWeightedSum / bases
  return {
    bestRefPos: refMean,
    shouldReverse:
      Math.abs(strandFraction) > decisiveStrandFraction || covariance === 0
        ? strandFraction < 0
        : covariance < 0,
  }
}

// Groups alignments by vertical-axis (query) chromosome, accumulates total
// aligned bases and strand per (query, reference) pair. Selects the reference
// chromosome with the most aligned bases as the anchor, then sorts query
// chromosomes to follow that reference's order, reversing a query chromosome
// that runs antiparallel to its anchor.
//
// - refRefName:   horizontal-axis (reference) chromosome
// - queryRefName: vertical-axis (query) chromosome
export async function diagonalizeRegions(
  alignments: AlignmentData[],
  referenceRegions: Region[],
  currentRegions: Region[],
  {
    stopToken,
    statusCallback,
  }: { stopToken?: StopToken; statusCallback?: StatusCallback } = {},
): Promise<DiagonalizationResult> {
  // Both passes below are long enough to notice on a whole-genome alignment —
  // the grouping walks every alignment, and the ordering pass sorts each query
  // chromosome's group. They used to share a single cancel check between them,
  // so the whole grouping pass ran after a cancel and the bar sat on the
  // fetch's last message throughout. Two reporters because the phases count
  // different things (alignments, then chromosomes), so one auto-incrementing
  // counter across both would report a meaningless fraction.
  const reportGrouping = createProgressReporter({
    label: 'Grouping alignments',
    total: alignments.length,
    statusCallback,
    stopToken,
  })
  // first appearance wins: a refName can appear in more than one reference
  // region, and the ordering key is where that chromosome starts on the axis
  const refOrder = new Map<string, number>()
  for (const [i, region] of referenceRegions.entries()) {
    if (!refOrder.has(region.refName)) {
      refOrder.set(region.refName, i)
    }
  }

  // outer key: vertical chrom; inner key: horizontal chrom. Alignments to a
  // reference chromosome the axis does not display are skipped: they can supply
  // neither an ordering index nor a comparable position.
  const queryGroups = new Map<string, Map<string, PairStats>>()
  for (const aln of alignments) {
    reportGrouping()
    const refIndex = refOrder.get(aln.refRefName)
    if (refIndex !== undefined) {
      let group = queryGroups.get(aln.queryRefName)
      if (!group) {
        group = new Map()
        queryGroups.set(aln.queryRefName, group)
      }
      let data = group.get(aln.refRefName)
      if (!data) {
        data = {
          refName: aln.refRefName,
          refIndex,
          bases: 0,
          strandWeightedSum: 0,
          alignments: [],
        }
        group.set(aln.refRefName, data)
      }
      const alnLength = aln.refEnd - aln.refStart
      data.bases += alnLength
      data.strandWeightedSum += (aln.strand >= 0 ? 1 : -1) * alnLength
      data.alignments.push(aln)
    }
  }

  const queryOrdering: {
    refName: string
    bestRefIndex: number
    bestRefPos: number
    shouldReverse: boolean
  }[] = []

  const reportOrdering = createProgressReporter({
    label: 'Ordering chromosomes',
    total: queryGroups.size,
    statusCallback,
    stopToken,
  })
  for (const [verticalChrom, group] of queryGroups) {
    reportOrdering()
    let best: PairStats | undefined
    for (const data of group.values()) {
      // the refName tiebreak is explicit because Map iteration follows insertion
      // order, which follows the order alignments arrived in
      if (
        !best ||
        data.bases > best.bases ||
        (data.bases === best.bases && cmpStr(data.refName, best.refName) < 0)
      ) {
        best = data
      }
    }
    // bases === 0 means every alignment was zero-length, leaving no position to
    // order by, so such a chromosome joins the unaligned tail below
    if (best !== undefined && best.bases > 0) {
      queryOrdering.push({
        refName: verticalChrom,
        bestRefIndex: best.refIndex,
        ...anchorStats(best),
      })
    }
  }

  checkStopToken(stopToken)

  queryOrdering.sort(
    (a, b) =>
      a.bestRefIndex - b.bestRefIndex ||
      a.bestRefPos - b.bestRefPos ||
      cmpStr(a.refName, b.refName),
  )

  // group by refName: a refName can appear in more than one region (e.g. a
  // chromosome displayed in multiple regions), and all of them move together
  const regionsByName = new Map<string, Region[]>()
  for (const region of currentRegions) {
    let group = regionsByName.get(region.refName)
    if (!group) {
      group = []
      regionsByName.set(region.refName, group)
    }
    group.push(region)
  }

  const orderedNames = new Set(queryOrdering.map(q => q.refName))
  const newQueryRegions: Region[] = []
  let regionsReversed = 0

  for (const { refName, shouldReverse } of queryOrdering) {
    for (const region of regionsByName.get(refName) ?? []) {
      newQueryRegions.push({ ...region, reversed: shouldReverse })
      if (shouldReverse !== (region.reversed ?? false)) {
        regionsReversed++
      }
    }
  }

  // Regions with no alignments are appended after the ordered ones
  const regionsWithoutAlignments = currentRegions.filter(
    r => !orderedNames.has(r.refName),
  )

  // Count how many regions ended up at a different position than they started
  // (within the subset that participated in the ordering — unaligned regions
  // keep their tail position and aren't counted as moves).
  const previousOrder = currentRegions
    .map(r => r.refName)
    .filter(name => orderedNames.has(name))
  let regionsReordered = 0
  for (let i = 0; i < newQueryRegions.length; i++) {
    if (newQueryRegions[i]!.refName !== previousOrder[i]) {
      regionsReordered++
    }
  }

  return {
    newRegions: [...newQueryRegions, ...regionsWithoutAlignments],
    stats: {
      regionsReordered,
      regionsReversed,
    },
  }
}
