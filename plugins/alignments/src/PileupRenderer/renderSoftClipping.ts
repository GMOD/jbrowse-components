import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { bpSpanPx } from '@jbrowse/core/util'
import { Theme } from '@mui/material'

// locals
import { Mismatch } from '../MismatchParser'
import { RenderArgsDeserializedWithFeaturesAndLayout } from './PileupRenderer'
import { fillRect, getCharWidthHeight, LayoutFeature } from './util'

export function renderSoftClipping({
  ctx,
  feat,
  renderArgs,
  config,
  theme,
  colorForBase,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
  config: AnyConfigurationModel
  colorForBase: Record<string, string>
  theme: Theme
  canvasWidth: number
}) {
  const { feature, topPx, heightPx } = feat
  const { regions, bpPerPx } = renderArgs
  const [region] = regions
  const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
  const mismatches = feature.get('mismatches') as Mismatch[] | undefined
  const seq = feature.get('seq') as string | undefined
  const { charWidth, charHeight } = getCharWidthHeight()

  // Display all bases softclipped off in lightened colors
  if (!(seq && mismatches)) {
    return
  }

  const heightLim = charHeight - 2
  for (const mismatch of mismatches) {
    if (mismatch.type === 'softclip') {
      const len = mismatch.cliplen || 0
      const s = feature.get('start')
      const start = mismatch.start === 0 ? s - len : s + mismatch.start

      for (let k = 0; k < len; k += 1) {
        const base = seq.charAt(k + mismatch.start)

        // If softclip length+start is longer than sequence, no need to
        // continue showing base
        if (!base) {
          return
        }

        const s0 = start + k
        const [leftPx, rightPx] = bpSpanPx(s0, s0 + 1, region, bpPerPx)
        const widthPx = Math.max(minFeatWidth, rightPx - leftPx)

        // Black accounts for IUPAC ambiguity code bases such as N that
        // show in soft clipping
        const baseColor = colorForBase[base] || '#000000'
        ctx.fillStyle = baseColor
        fillRect(ctx, leftPx, topPx, widthPx, heightPx, canvasWidth)

        if (widthPx >= charWidth && heightPx >= heightLim) {
          ctx.fillStyle = theme.palette.getContrastText(baseColor)
          ctx.fillText(
            base,
            leftPx + (widthPx - charWidth) / 2 + 1,
            topPx + heightPx,
          )
        }
      }
    }
  }
}
