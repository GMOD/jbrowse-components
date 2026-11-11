import {
  leavesRoom,
  quartileGap,
  spanGaps,
} from '@jbrowse/render-core/marks/sparseSpans'

import { RECT_FLAG_SPARSE_EXONS } from './components/sharedRendererConstants.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

type SparseExonInput = Pick<
  FeatureDataResult,
  | 'rectPositions'
  | 'rectFeatureIndices'
  | 'rectChildOrdinals'
  | 'rectDensityFade'
> & { flatbushItems: readonly { collapsibleIntrons?: boolean }[] }

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
  return spanGaps(
    rects.map((i): [number, number] => [
      toDrawnBp(data.rectPositions[i * 2]!),
      toDrawnBp(data.rectPositions[i * 2 + 1]!),
    ]),
  )
}

// Mutates the clone `cloneMutableFields` made, in place.
export function applySparseExonFlags(
  data: SparseExonInput,
  bpPerPx: number,
  toDrawnBp: (bp: number) => number,
) {
  for (const rects of rectsByTranscript(data).values()) {
    if (
      leavesRoom(quartileGap(intronGapsBp(data, rects, toDrawnBp)), bpPerPx)
    ) {
      for (const i of rects) {
        data.rectDensityFade[i]! |= RECT_FLAG_SPARSE_EXONS
      }
    }
  }
}
