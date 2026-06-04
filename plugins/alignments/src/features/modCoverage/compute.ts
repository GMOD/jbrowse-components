import { packAbgr } from '@jbrowse/core/util/colorBits'

import { calculateModificationCounts } from '../../shared/calculateModificationCounts.ts'

import type { StrandBaseCounts } from '../../shared/calculateModificationCounts.ts'
import type {
  MismatchData,
  ModificationEntry,
} from '../../shared/webglRpcTypes.ts'

interface ModificationColorEntry {
  r: number
  g: number
  b: number
  probabilityTotal: number
  probabilityCount: number
  base: string
  modType: string
  noMod: boolean
}

// Fixed stack order so a position's segments never swap between frames (they
// otherwise stacked in read-arrival order). Mirrors IGV's modificationRankOrder
// but renders modified calls BELOW the no-modification bucket, so e.g. red 5mC
// always sits under blue unmodified. Lower rank = drawn first = bottom.
const MOD_TYPE_RANK: Record<string, number> = {
  m: 0,
  h: 1,
  f: 2,
  c: 3,
  C: 4,
  g: 5,
  e: 6,
  b: 7,
  a: 8,
  o: 9,
}
// Total order (no ties) so it's deterministic for numeric ChEBI codes too, which
// share the fallback rank and need the lexical modType tiebreak to not swap.
function compareModEntries(a: ModificationColorEntry, b: ModificationColorEntry) {
  const ra = MOD_TYPE_RANK[a.modType] ?? 99
  const rb = MOD_TYPE_RANK[b.modType] ?? 99
  return a.noMod !== b.noMod
    ? a.noMod
      ? 1
      : -1
    : ra !== rb
      ? ra - rb
      : a.modType < b.modType
        ? -1
        : a.modType > b.modType
          ? 1
          : 0
}

export function computeModificationCoverage(
  modifications: ModificationEntry[],
  mismatches: MismatchData[],
  regionStart: number,
  coverage: {
    depths: Float32Array
    maxDepth: number
    startPos: number
    fwdDepths: Float32Array | undefined
    revDepths: Float32Array | undefined
  },
  regionSequence: string | undefined,
  regionSequenceStart: number,
  simplexModifications: ReadonlySet<string>,
) {
  const {
    depths,
    maxDepth: regionMaxDepth,
    startPos: depthStartOffset,
    fwdDepths,
    revDepths,
  } = coverage
  if (modifications.length === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colors: new Uint32Array(0),
      relDepths: new Float32Array(0),
      count: 0,
    }
  }

  // The simplex denominator is computed from per-strand base counts, which the
  // mod-coverage path always supplies (trackStrands is enabled whenever
  // methylation/modification coloring is on). Treat their absence as a bug
  // rather than silently falling back to a strand-blind count that would drop
  // reverse-strand simplex calls.
  if (!fwdDepths || !revDepths) {
    throw new Error('modification coverage requires per-strand depths')
  }

  const snpByPosition = new Map<number, StrandBaseCounts>()
  for (const mm of mismatches) {
    if (mm.position < regionStart) {
      continue
    }
    let entry = snpByPosition.get(mm.position)
    if (!entry) {
      entry = {}
      snpByPosition.set(mm.position, entry)
    }
    const base = String.fromCharCode(mm.base)
    entry[base] ??= { fwd: 0, rev: 0 }
    if (mm.strand === 1) {
      entry[base].fwd++
    } else {
      entry[base].rev++
    }
  }

  const byPosition = new Map<number, Map<number, ModificationColorEntry>>()

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    let colorMap = byPosition.get(mod.position)
    if (!colorMap) {
      colorMap = new Map()
      byPosition.set(mod.position, colorMap)
    }
    // Pack the 0-255 rgb channels into one integer key — avoids a per-call
    // template-string allocation in this per-modification hot loop.
    const key = (mod.r << 16) | (mod.g << 8) | mod.b
    let entry = colorMap.get(key)
    if (!entry) {
      entry = {
        r: mod.r,
        g: mod.g,
        b: mod.b,
        probabilityTotal: 0,
        probabilityCount: 0,
        base: mod.base,
        modType: mod.modType,
        noMod: mod.noMod ?? false,
      }
      colorMap.set(key, entry)
    }
    entry.probabilityTotal += mod.prob
    entry.probabilityCount++
  }

  // yOffset/height are fractions of THIS position's coverage bar (per-position
  // semantics). relDepth = depthAtPos / regionMaxDepth feeds bar height at draw
  // time. See computeSNPCoverage for the same contract.
  const segments: {
    position: number
    yOffset: number
    height: number
    relDepth: number
    r: number
    g: number
    b: number
    alpha: number
  }[] = []

  for (const [position, colorMap] of byPosition) {
    const binIdx = Math.floor(position - depthStartOffset)
    const depthAtPosition = depths[binIdx] ?? 0
    if (depthAtPosition === 0) {
      continue
    }

    const refbase = regionSequence
      ? regionSequence[position - regionSequenceStart]!.toUpperCase()
      : 'N'

    // Copy the SNP strand counts and tally their per-strand totals in one pass;
    // every non-SNP read shows the reference base, so the leftover fwd/rev depth
    // is attributed to refbase. This is the single source for both the modifiable
    // and detectable denominators (the strand-blind count is just fwd + rev).
    // SNP bases never collide with refbase (a SNP is by definition a non-ref
    // base), so the refbase entry below is always fresh.
    const strandBaseCounts: StrandBaseCounts = {}
    let snpFwd = 0
    let snpRev = 0
    const snpStrandBaseCounts = snpByPosition.get(position)
    if (snpStrandBaseCounts) {
      for (const base in snpStrandBaseCounts) {
        const sc = snpStrandBaseCounts[base]!
        strandBaseCounts[base] = { fwd: sc.fwd, rev: sc.rev }
        snpFwd += sc.fwd
        snpRev += sc.rev
      }
    }
    const refFwd = Math.max(0, (fwdDepths[binIdx] ?? 0) - snpFwd)
    const refRev = Math.max(0, (revDepths[binIdx] ?? 0) - snpRev)
    strandBaseCounts[refbase] = { fwd: refFwd, rev: refRev }

    let yOffset = 0
    const orderedEntries = [...colorMap.values()].sort(compareModEntries)
    for (const entry of orderedEntries) {
      const { modifiable, detectable } = calculateModificationCounts({
        base: entry.base,
        isSimplex: simplexModifications.has(entry.modType),
        strandBaseCounts,
      })

      if (detectable === 0) {
        continue
      }

      // This modification's share of the position's coverage bar, mirroring
      // IGV's BaseModificationCoverageRenderer: (modifiable/depth) scales the
      // count of above-threshold reads down to the reads that even carry the
      // base, and dividing by `detectable` (not `depth`) corrects for simplex
      // data, where only the examined strand was basecalled so half the reads
      // could never show the modification. For duplex `detectable === modifiable`
      // and this collapses to `probabilityCount / depth`. The bar height is a
      // plain read COUNT, not a probability-weighted sum — IGV weights each
      // qualifying read as 1; likelihood only feeds the color/alpha below
      // (averageLikelihood). Bounded to [0,1]: modifiable <= depth and
      // probabilityCount <= detectable (every modified read is detectable).
      const height =
        (modifiable / depthAtPosition) * (entry.probabilityCount / detectable)

      const avgProbability = entry.probabilityTotal / entry.probabilityCount

      segments.push({
        position,
        yOffset,
        height,
        relDepth: depthAtPosition / regionMaxDepth,
        r: entry.r,
        g: entry.g,
        b: entry.b,
        alpha: Math.round(avgProbability * 255),
      })
      yOffset += height
    }
  }

  const positions = new Uint32Array(segments.length)
  const yOffsets = new Float32Array(segments.length)
  const heights = new Float32Array(segments.length)
  // Packed ABGR u32 per segment (alpha byte = seg.alpha, 0..255).
  const colors = new Uint32Array(segments.length)
  const relDepths = new Float32Array(segments.length)

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    positions[i] = seg.position
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colors[i] = packAbgr(seg.r, seg.g, seg.b, seg.alpha)
    relDepths[i] = seg.relDepth
  }

  return {
    positions,
    yOffsets,
    heights,
    colors,
    relDepths,
    count: segments.length,
  }
}
