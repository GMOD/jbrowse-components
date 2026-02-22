import { max, min } from '@jbrowse/core/util'

import { getModificationName } from './modificationData.ts'
import { getColorForModification } from '../util.ts'

import type { ModificationEntry } from './webglRpcTypes.ts'
import type { CoverageTooltipBin } from '../RenderWebGLPileupDataRPC/types'

export function buildTooltipData({
  mismatches,
  insertions,
  gaps,
  softclips,
  hardclips,
  modifications,
  regionStart,
  coverage,
}: {
  mismatches: { position: number; base: number; strand: number }[]
  insertions: { position: number; length: number; sequence?: string }[]
  gaps: { start: number; end: number; type: 'deletion' | 'skip' }[]
  softclips: { position: number; length: number }[]
  hardclips: { position: number; length: number }[]
  modifications: ModificationEntry[]
  regionStart: number
  coverage: { depths: Float32Array; startOffset: number; binSize: number }
}) {
  const tooltipData = new Map<number, CoverageTooltipBin>()

  function getOrCreateBin(posOffset: number, position: number) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = { position, depth, snps: {}, interbase: {} }
      tooltipData.set(posOffset, bin)
    }
    return bin
  }

  for (const mm of mismatches) {
    if (mm.position < regionStart) {
      continue
    }
    const posOffset = mm.position - regionStart
    const bin = getOrCreateBin(posOffset, mm.position)
    const baseName = String.fromCharCode(mm.base)
    if (!bin.snps[baseName]) {
      bin.snps[baseName] = { count: 0, fwd: 0, rev: 0 }
    }
    bin.snps[baseName].count++
    if (mm.strand === 1) {
      bin.snps[baseName].fwd++
    } else {
      bin.snps[baseName].rev++
    }
  }

  const insertionsByPos = new Map<
    number,
    { lengths: number[]; sequences: string[] }
  >()
  for (const ins of insertions) {
    if (ins.position < regionStart) {
      continue
    }
    const posOffset = ins.position - regionStart
    let data = insertionsByPos.get(posOffset)
    if (!data) {
      data = { lengths: [], sequences: [] }
      insertionsByPos.set(posOffset, data)
    }
    data.lengths.push(ins.length)
    if (ins.sequence) {
      data.sequences.push(ins.sequence)
    }
  }

  for (const [posOffset, data] of insertionsByPos) {
    const bin = getOrCreateBin(posOffset, regionStart + posOffset)
    const minLen = min(data.lengths)
    const maxLen = max(data.lengths)
    const avgLen = data.lengths.reduce((a, b) => a + b, 0) / data.lengths.length
    let topSeq: string | undefined
    let topSeqCount = 0
    if (data.sequences.length > 0) {
      const seqCounts = new Map<string, number>()
      for (const seq of data.sequences) {
        seqCounts.set(seq, (seqCounts.get(seq) ?? 0) + 1)
      }
      for (const [seq, count] of seqCounts) {
        if (count > topSeqCount) {
          topSeqCount = count
          topSeq = seq
        }
      }
    }
    bin.interbase.insertion = {
      count: data.lengths.length,
      minLen,
      maxLen,
      avgLen,
      topSeq,
      topSeqCount,
    }
  }

  const deletionsByPos = new Map<number, number[]>()
  const skipsByPos = new Map<number, number[]>()
  for (const gap of gaps) {
    if (gap.end < regionStart) {
      continue
    }
    const startOffset = Math.max(0, gap.start - regionStart)
    const endOffset = gap.end - regionStart
    const length = gap.end - gap.start
    const targetMap = gap.type === 'deletion' ? deletionsByPos : skipsByPos
    for (let pos = startOffset; pos < endOffset; pos++) {
      let lengths = targetMap.get(pos)
      if (!lengths) {
        lengths = []
        targetMap.set(pos, lengths)
      }
      lengths.push(length)
    }
  }

  for (const [posOffset, lengths] of deletionsByPos) {
    const bin = getOrCreateBin(posOffset, regionStart + posOffset)
    const minLen = min(lengths)
    const maxLen = max(lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.deletions = { count: lengths.length, minLen, maxLen, avgLen }
  }

  for (const [posOffset, lengths] of skipsByPos) {
    const bin = getOrCreateBin(posOffset, regionStart + posOffset)
    const minLen = min(lengths)
    const maxLen = max(lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.skips = { count: lengths.length, minLen, maxLen, avgLen }
  }

  const softclipsByPos = new Map<number, number[]>()
  for (const sc of softclips) {
    if (sc.position < regionStart) {
      continue
    }
    const posOffset = sc.position - regionStart
    let lengths = softclipsByPos.get(posOffset)
    if (!lengths) {
      lengths = []
      softclipsByPos.set(posOffset, lengths)
    }
    lengths.push(sc.length)
  }

  for (const [posOffset, lengths] of softclipsByPos) {
    const bin = getOrCreateBin(posOffset, regionStart + posOffset)
    const minLen = min(lengths)
    const maxLen = max(lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.interbase.softclip = { count: lengths.length, minLen, maxLen, avgLen }
  }

  const hardclipsByPos = new Map<number, number[]>()
  for (const hc of hardclips) {
    if (hc.position < regionStart) {
      continue
    }
    const posOffset = hc.position - regionStart
    let lengths = hardclipsByPos.get(posOffset)
    if (!lengths) {
      lengths = []
      hardclipsByPos.set(posOffset, lengths)
    }
    lengths.push(hc.length)
  }

  for (const [posOffset, lengths] of hardclipsByPos) {
    const bin = getOrCreateBin(posOffset, regionStart + posOffset)
    const minLen = min(lengths)
    const maxLen = max(lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.interbase.hardclip = { count: lengths.length, minLen, maxLen, avgLen }
  }

  if (modifications.length > 0) {
    for (const mod of modifications) {
      if (mod.position < regionStart) {
        continue
      }
      const posOffset = mod.position - regionStart
      const bin = getOrCreateBin(posOffset, mod.position)
      if (!bin.modifications) {
        bin.modifications = {}
      }
      const modKey = mod.modType
      if (!bin.modifications[modKey]) {
        bin.modifications[modKey] = {
          count: 0,
          fwd: 0,
          rev: 0,
          probabilityTotal: 0,
          color: getColorForModification(mod.modType),
          name: getModificationName(mod.modType),
        }
      }
      bin.modifications[modKey].count++
      bin.modifications[modKey].probabilityTotal += mod.prob
      if (mod.strand === 1) {
        bin.modifications[modKey].fwd++
      } else {
        bin.modifications[modKey].rev++
      }
    }
  }

  const SNP_SIGNIFICANCE_THRESHOLD = 0.05
  const significantSnpOffsets: number[] = []
  for (const [posOffset, bin] of tooltipData) {
    if (bin.depth > 0) {
      let totalSnpCount = 0
      for (const snp of Object.values(bin.snps)) {
        totalSnpCount += snp.count
      }
      if (totalSnpCount / bin.depth > SNP_SIGNIFICANCE_THRESHOLD) {
        significantSnpOffsets.push(posOffset)
      }
    }
  }
  significantSnpOffsets.sort((a, b) => a - b)

  return { tooltipData, significantSnpOffsets }
}
