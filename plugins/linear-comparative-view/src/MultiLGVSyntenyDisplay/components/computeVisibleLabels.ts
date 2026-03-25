import { parseCigar2 } from '@jbrowse/plugin-alignments'

import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  OP_D,
  OP_EQ,
  OP_I,
  OP_M,
  OP_N,
  OP_X,
  isCsOpChar,
  isDigit,
} from './cigarConstants.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface VisibleLabel {
  type: 'deletion' | 'insertion' | 'mismatch'
  x: number
  y: number
  text: string
}

const MIN_MISMATCH_PX_PER_BP = 6
const MIN_HEIGHT_FOR_TEXT = 8
const MIN_DELETION_WIDTH_PX = 12

interface LabelContext {
  labels: VisibleLabel[]
  x: number
  y: number
  w: number
  h: number
  bpLen: number
}

function addCigarLabels(ctx: LabelContext, cigar: number[]) {
  const { x, y, w, h, bpLen, labels } = ctx
  const pxPerBp = w / bpLen
  let refPos = 0

  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === OP_M || op === OP_EQ) {
      refPos += len
    } else if (op === OP_X) {
      if (len > 1) {
        const pw = len * pxPerBp
        if (pw > MIN_DELETION_WIDTH_PX && h >= MIN_HEIGHT_FOR_TEXT) {
          labels.push({
            type: 'mismatch',
            x: x + (refPos + len / 2) * pxPerBp,
            y: y + h / 2,
            text: `${len}`,
          })
        }
      }
      refPos += len
    } else if (op === OP_D || op === OP_N) {
      const pw = len * pxPerBp
      if (pw > MIN_DELETION_WIDTH_PX && h >= MIN_HEIGHT_FOR_TEXT) {
        labels.push({
          type: 'deletion',
          x: x + (refPos + len / 2) * pxPerBp,
          y: y + h / 2,
          text: `${len}`,
        })
      }
      refPos += len
    } else if (op === OP_I) {
      const isLong = len >= LONG_INSERTION_MIN_LENGTH
      const widthPx = isLong ? len * pxPerBp : 0
      if (
        isLong &&
        widthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX &&
        h >= MIN_HEIGHT_FOR_TEXT
      ) {
        labels.push({
          type: 'insertion',
          x: x + refPos * pxPerBp,
          y: y + h / 2,
          text: `${len}`,
        })
      }
    }
  }
}

function addCsLabels(ctx: LabelContext, cs: string) {
  const { x, y, w, h, bpLen, labels } = ctx
  const pxPerBp = w / bpLen
  let refPos = 0
  let i = 0

  while (i < cs.length) {
    const ch = cs[i]!

    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2] ?? ''
      if (pxPerBp >= MIN_MISMATCH_PX_PER_BP && h >= MIN_HEIGHT_FOR_TEXT) {
        labels.push({
          type: 'mismatch',
          x: x + (refPos + 0.5) * pxPerBp,
          y: y + h / 2,
          text: queryBase.toUpperCase(),
        })
      }
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      let len = 0
      while (i < cs.length && !isCsOpChar(cs[i])) {
        len++
        i++
      }
      if (len > 0) {
        const pw = len * pxPerBp
        if (pw > MIN_DELETION_WIDTH_PX && h >= MIN_HEIGHT_FOR_TEXT) {
          labels.push({
            type: 'deletion',
            x: x + (refPos + len / 2) * pxPerBp,
            y: y + h / 2,
            text: `${len}`,
          })
        }
        refPos += len
      }
    } else if (ch === '+') {
      i++
      let len = 0
      while (i < cs.length && !isCsOpChar(cs[i])) {
        len++
        i++
      }
      if (len > 0) {
        const isLong = len >= LONG_INSERTION_MIN_LENGTH
        const widthPx = isLong ? len * pxPerBp : 0
        if (
          isLong &&
          widthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX &&
          h >= MIN_HEIGHT_FOR_TEXT
        ) {
          labels.push({
            type: 'insertion',
            x: x + refPos * pxPerBp,
            y: y + h / 2,
            text: `${len}`,
          })
        }
      }
    } else {
      i++
    }
  }
}

export function computeMultiSyntenyLabels(
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  rowHeight: number,
  labelW: number,
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

  const padding = rowHeight >= 6 ? 1 : 0

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
      const x1 = px1.offsetPx - offsetPx + labelW
      const x2 = px2.offsetPx - offsetPx + labelW
      const blockWidth = x2 - x1

      // Skip features entirely off-screen
      if (x1 + blockWidth < labelW || x1 > viewWidth) {
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
      }

      if (feat.cs) {
        addCsLabels(ctx, feat.cs)
      } else if (feat.cigar) {
        addCigarLabels(ctx, parseCigar2(feat.cigar))
      }
    }
  }

  return labels
}
