import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  computeLabelFontSize,
  visitCigarOps,
  visitCsOps,
} from '@jbrowse/alignments-core'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface VisibleLabel {
  type: 'deletion' | 'insertion' | 'mismatch'
  x: number
  y: number
  text: string
  fontSize: number
}

const MIN_MISMATCH_PX_PER_BP = 6
const MIN_DELETION_WIDTH_PX = 12

interface LabelView {
  bpToPx(arg: {
    refName: string
    coord: number
  }): { offsetPx: number } | undefined
  offsetPx: number
  width: number
}

interface ComputeMultiSyntenyLabelsParams {
  view: LabelView
  genomeRows: Map<string, MultiPairFeature[]>
  displayedGenomes: string[]
  rowHeight: number
  rowSpacing: boolean
  showSnps: boolean
}

export function computeMultiSyntenyLabels(
  params: ComputeMultiSyntenyLabelsParams,
) {
  const {
    view,
    genomeRows,
    displayedGenomes,
    rowHeight,
    rowSpacing,
    showSnps,
  } = params
  const labels: VisibleLabel[] = []
  const padding = rowSpacing ? 1 : 0
  const h = rowHeight - padding * 2
  if (!showSnps || h < MIN_HEIGHT_FOR_TEXT) {
    return labels
  }
  const fontSize = computeLabelFontSize(h)

  for (let g = 0; g < displayedGenomes.length; g++) {
    const features = genomeRows.get(displayedGenomes[g]!)
    if (!features) {
      continue
    }
    const yMid = g * rowHeight + padding + h / 2

    for (const feat of features) {
      if (!feat.cs && !feat.cigar) {
        continue
      }
      const px1 = view.bpToPx({ refName: feat.origRefName, coord: feat.start })
      const px2 = view.bpToPx({ refName: feat.origRefName, coord: feat.end })
      if (!px1 || !px2) {
        continue
      }
      const x = px1.offsetPx - view.offsetPx
      const w = px2.offsetPx - view.offsetPx - x
      if (x + w < 0 || x > view.width) {
        continue
      }
      const pxPerBp = w / (feat.end - feat.start)
      const featStart = feat.start

      const visitor = {
        onMismatch(refPos: number, len: number, queryBase?: string) {
          const local = refPos - featStart
          if (queryBase && len === 1 && pxPerBp >= MIN_MISMATCH_PX_PER_BP) {
            labels.push({
              type: 'mismatch',
              x: x + (local + 0.5) * pxPerBp,
              y: yMid,
              text: queryBase.toUpperCase(),
              fontSize,
            })
          } else if (len > 1 && len * pxPerBp > MIN_DELETION_WIDTH_PX) {
            labels.push({
              type: 'mismatch',
              x: x + (local + len / 2) * pxPerBp,
              y: yMid,
              text: `${len}`,
              fontSize,
            })
          }
        },
        onDeletion(refPos: number, len: number) {
          if (len * pxPerBp > MIN_DELETION_WIDTH_PX) {
            labels.push({
              type: 'deletion',
              x: x + (refPos - featStart + len / 2) * pxPerBp,
              y: yMid,
              text: `${len}`,
              fontSize,
            })
          }
        },
        onInsertion(refPos: number, len: number) {
          if (
            len >= LONG_INSERTION_MIN_LENGTH &&
            len * pxPerBp >= LONG_INSERTION_TEXT_THRESHOLD_PX
          ) {
            labels.push({
              type: 'insertion',
              x: x + (refPos - featStart) * pxPerBp,
              y: yMid,
              text: `${len}`,
              fontSize,
            })
          }
        },
      }

      if (feat.cs) {
        visitCsOps(feat.cs, featStart, visitor)
      } else {
        visitCigarOps(parseCigar2(feat.cigar), featStart, visitor)
      }
    }
  }

  return labels
}
