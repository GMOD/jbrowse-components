import { packAbgr } from '@jbrowse/core/util/colorBits'

import { calculateModificationCounts } from '../../shared/calculateModificationCounts.ts'

import type {
  MismatchData,
  ModificationEntry,
} from '../../shared/webglRpcTypes.ts'

interface SnpCountEntry {
  baseCounts: Record<string, number>
  strandBaseCounts: Record<string, { fwd: number; rev: number }>
}

interface ModificationColorEntry {
  r: number
  g: number
  b: number
  probabilityTotal: number
  probabilityCount: number
  base: string
  isSimplex: boolean
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

  const snpByPosition = new Map<number, SnpCountEntry>()
  for (const mm of mismatches) {
    if (mm.position < regionStart) {
      continue
    }
    let entry = snpByPosition.get(mm.position)
    if (!entry) {
      entry = { baseCounts: {}, strandBaseCounts: {} }
      snpByPosition.set(mm.position, entry)
    }
    const base = String.fromCharCode(mm.base)
    entry.baseCounts[base] = (entry.baseCounts[base] ?? 0) + 1
    entry.strandBaseCounts[base] ??= { fwd: 0, rev: 0 }
    if (mm.strand === 1) {
      entry.strandBaseCounts[base].fwd++
    } else {
      entry.strandBaseCounts[base].rev++
    }
  }

  const byPosition = new Map<number, Map<string, ModificationColorEntry>>()

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    let colorMap = byPosition.get(mod.position)
    if (!colorMap) {
      colorMap = new Map()
      byPosition.set(mod.position, colorMap)
    }
    const key = `${mod.r},${mod.g},${mod.b}`
    let entry = colorMap.get(key)
    if (!entry) {
      entry = {
        r: mod.r,
        g: mod.g,
        b: mod.b,
        probabilityTotal: 0,
        probabilityCount: 0,
        base: mod.base,
        isSimplex: mod.isSimplex,
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

    const snpEntry = snpByPosition.get(position)
    const snpBaseCounts = snpEntry?.baseCounts ?? {}
    const snpStrandBaseCounts = snpEntry?.strandBaseCounts ?? {}

    const totalSnp = Object.values(snpBaseCounts).reduce((a, b) => a + b, 0)
    const refCount = Math.max(0, depthAtPosition - totalSnp)

    const baseCounts: Record<string, number> = { ...snpBaseCounts }
    baseCounts[refbase] = (baseCounts[refbase] ?? 0) + refCount

    const strandBaseCounts: Record<string, { fwd: number; rev: number }> = {}
    for (const [base, sc] of Object.entries(snpStrandBaseCounts)) {
      strandBaseCounts[base] = { ...sc }
    }

    if (fwdDepths && revDepths) {
      const fwdDepthAtPosition = fwdDepths[binIdx] ?? 0
      const revDepthAtPosition = revDepths[binIdx] ?? 0
      let snpFwd = 0
      let snpRev = 0
      for (const sc of Object.values(snpStrandBaseCounts)) {
        snpFwd += sc.fwd
        snpRev += sc.rev
      }
      const refFwd = Math.max(0, fwdDepthAtPosition - snpFwd)
      const refRev = Math.max(0, revDepthAtPosition - snpRev)
      strandBaseCounts[refbase] ??= { fwd: 0, rev: 0 }
      strandBaseCounts[refbase].fwd += refFwd
      strandBaseCounts[refbase].rev += refRev
    } else {
      strandBaseCounts[refbase] ??= { fwd: 0, rev: 0 }
      strandBaseCounts[refbase].fwd += refCount
    }

    let yOffset = 0
    for (const entry of colorMap.values()) {
      const { modifiable, detectable } = calculateModificationCounts({
        base: entry.base,
        isSimplex: entry.isSimplex,
        refbase,
        baseCounts,
        strandBaseCounts,
      })

      // height = mod-fraction × avg-probability, both as fractions of this
      // position's reads. Multiplied by per-position bar height at draw time.
      const height =
        (modifiable * entry.probabilityTotal) / (detectable * depthAtPosition)

      const avgProbability =
        entry.probabilityCount > 0
          ? entry.probabilityTotal / entry.probabilityCount
          : 0

      if (!Number.isNaN(height)) {
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
