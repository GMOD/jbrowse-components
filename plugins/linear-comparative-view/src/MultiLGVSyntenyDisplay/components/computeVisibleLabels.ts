import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  computeLabelFontSize,
} from '@jbrowse/alignments-core'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { visitCigarOps, visitCsOps } from '@jbrowse/alignments-core'

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

interface LabelContext {
  labels: VisibleLabel[]
  x: number
  y: number
  w: number
  h: number
  bpLen: number
  featStart: number
}

function makeLabelVisitor(ctx: LabelContext) {
  const { x, y, w, h, bpLen, labels } = ctx
  const pxPerBp = w / bpLen
  const fontSize = computeLabelFontSize(h)
  const featStart = ctx.featStart

  return {
    onMismatch(refPos: number, len: number, queryBase?: string) {
      if (h < MIN_HEIGHT_FOR_TEXT) {
        return
      }
      const localRefPos = refPos - featStart
      if (queryBase && len === 1) {
        if (pxPerBp >= MIN_MISMATCH_PX_PER_BP) {
          labels.push({
            type: 'mismatch',
            x: x + (localRefPos + 0.5) * pxPerBp,
            y: y + h / 2,
            text: queryBase.toUpperCase(),
            fontSize,
          })
        }
      } else if (len > 1) {
        const pw = len * pxPerBp
        if (pw > MIN_DELETION_WIDTH_PX) {
          labels.push({
            type: 'mismatch',
            x: x + (localRefPos + len / 2) * pxPerBp,
            y: y + h / 2,
            text: `${len}`,
            fontSize,
          })
        }
      }
    },
    onDeletion(refPos: number, len: number) {
      if (h < MIN_HEIGHT_FOR_TEXT) {
        return
      }
      const localRefPos = refPos - featStart
      const pw = len * pxPerBp
      if (pw > MIN_DELETION_WIDTH_PX) {
        labels.push({
          type: 'deletion',
          x: x + (localRefPos + len / 2) * pxPerBp,
          y: y + h / 2,
          text: `${len}`,
          fontSize,
        })
      }
    },
    onInsertion(refPos: number, len: number) {
      if (h < MIN_HEIGHT_FOR_TEXT) {
        return
      }
      const localRefPos = refPos - featStart
      const isLarge =
        len >= LONG_INSERTION_MIN_LENGTH &&
        len * pxPerBp >= LONG_INSERTION_TEXT_THRESHOLD_PX
      if (isLarge) {
        labels.push({
          type: 'insertion',
          x: x + localRefPos * pxPerBp,
          y: y + h / 2,
          text: `${len}`,
          fontSize,
        })
      }
    },
  }
}

export function computeMultiSyntenyLabels(
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  rowHeight: number,
  rowSpacing: boolean,
  showSnps: boolean,
  bpToPx: (arg: {
    refName: string
    coord: number
  }) => { offsetPx: number } | undefined,
  offsetPx: number,
  viewWidth: number,
) {
  const labels: VisibleLabel[] = []
  if (!showSnps || rowHeight < MIN_HEIGHT_FOR_TEXT) {
    return labels
  }

  const padding = rowSpacing ? 1 : 0

  for (let g = 0; g < displayedGenomes.length; g++) {
    const genomeName = displayedGenomes[g]!
    const features = genomeRows.get(genomeName)
    if (!features) {
      continue
    }
    const fy = g * rowHeight + padding
    const fh = rowHeight - padding * 2

    for (const feat of features) {
      if (!feat.cs && !feat.cigar) {
        continue
      }
      const px1 = bpToPx({ refName: feat.origRefName, coord: feat.start })
      const px2 = bpToPx({ refName: feat.origRefName, coord: feat.end })
      if (!px1 || !px2) {
        continue
      }
      const x1 = px1.offsetPx - offsetPx
      const x2 = px2.offsetPx - offsetPx
      const blockWidth = x2 - x1

      // Skip features entirely off-screen
      if (x1 + blockWidth < 0 || x1 > viewWidth) {
        continue
      }

      const bpLen = feat.end - feat.start
      const ctx: LabelContext = {
        labels,
        x: x1,
        y: fy,
        w: blockWidth,
        h: fh,
        bpLen,
        featStart: feat.start,
      }
      const visitor = makeLabelVisitor(ctx)

      if (feat.cs) {
        visitCsOps(feat.cs, feat.start, visitor)
      } else if (feat.cigar) {
        visitCigarOps(parseCigar2(feat.cigar), feat.start, visitor)
      }
    }
  }

  return labels
}
