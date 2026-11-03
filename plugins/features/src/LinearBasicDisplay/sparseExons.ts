import { RECT_FLAG_SPARSE_EXONS } from './components/sharedRendererConstants.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

type SparseExonInput = Pick<
  FeatureDataResult,
  | 'rectPositions'
  | 'rectFeatureIndices'
  | 'rectChildOrdinals'
  | 'rectDensityFade'
> & { flatbushItems: readonly { collapsibleIntrons?: boolean }[] }

// The lower quartile, not the median: a gene whose exons come in tight clusters
// has a roomy median and would still fuse its clusters into blocks.
const SPARSE_EXON_GAP_QUANTILE = 0.25
const SPARSE_EXON_MIN_GAP_PX = 4

function transcriptKey(data: SparseExonInput, i: number) {
  const ordinal = data.rectChildOrdinals[i]
  return ordinal === undefined
    ? `${data.rectFeatureIndices[i]}`
    : `${data.rectFeatureIndices[i]}:${ordinal}`
}

// Only features whose parts introns separate (`collapsibleIntronsOf`): a
// repeat_region's or a synteny block's parts leave gaps too, but those gaps are
// not introns.
function rectsByTranscript(data: SparseExonInput) {
  const groups = new Map<string, number[]>()
  for (let i = 0; i < data.rectFeatureIndices.length; i++) {
    if (data.flatbushItems[data.rectFeatureIndices[i]!]?.collapsibleIntrons) {
      const key = transcriptKey(data, i)
      const group = groups.get(key)
      if (group) {
        group.push(i)
      } else {
        groups.set(key, [i])
      }
    }
  }
  return groups
}

// Gaps between the transcript's exons once its CDS and UTR pieces, which abut,
// are merged; measured on the drawn axis so a collapsed intron counts as drawn.
function intronGapsBp(
  data: SparseExonInput,
  rects: number[],
  toDrawnBp: (bp: number) => number,
) {
  const spans = rects
    .map((i): [number, number] => [
      data.rectPositions[i * 2]!,
      data.rectPositions[i * 2 + 1]!,
    ])
    .sort((a, b) => a[0] - b[0])
  const gaps: number[] = []
  let end = spans[0]![1]
  for (const [start, stop] of spans.slice(1)) {
    if (start > end) {
      gaps.push(toDrawnBp(start) - toDrawnBp(end))
    }
    end = Math.max(end, stop)
  }
  return gaps.sort((a, b) => a - b)
}

function isSparseTranscript(gapsBp: number[], bpPerPx: number) {
  return (
    gapsBp.length > 0 &&
    gapsBp[Math.floor((gapsBp.length - 1) * SPARSE_EXON_GAP_QUANTILE)]! /
      bpPerPx >=
      SPARSE_EXON_MIN_GAP_PX
  )
}

// Mutates the clone `cloneMutableFields` made, in place.
export function applySparseExonFlags(
  data: SparseExonInput,
  bpPerPx: number,
  toDrawnBp: (bp: number) => number,
) {
  for (const rects of rectsByTranscript(data).values()) {
    if (isSparseTranscript(intronGapsBp(data, rects, toDrawnBp), bpPerPx)) {
      for (const i of rects) {
        data.rectDensityFade[i]! |= RECT_FLAG_SPARSE_EXONS
      }
    }
  }
}
