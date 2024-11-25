import { readConfObject } from '@jbrowse/core/configuration'
import { bpSpanPx } from '@jbrowse/core/util'

// locals
import { fillRect, getCharWidthHeight } from './util'
import { parseCigar } from '../MismatchParser'
import type { RenderArgsDeserializedWithFeaturesAndLayout } from './PileupRenderer'
import type { LayoutFeature } from './util'
import type { Mismatch } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Theme } from '@mui/material'

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
  const region = regions[0]!
  const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
  const mismatches = feature.get('mismatches') as Mismatch[] | undefined
  const seq = feature.get('seq') as string | undefined
  const { charWidth, charHeight } = getCharWidthHeight()

  // Display all bases softclipped off in lightened colors
  if (!(seq && mismatches)) {
    return
  }

  const heightLim = charHeight - 2
  let seqOffset = 0
  let refOffset = 0
  const CIGAR = feature.get('CIGAR')
  const cigarOps = parseCigar(CIGAR)
  for (let i = 0; i < cigarOps.length; i += 2) {
    const op = cigarOps[i + 1]!
    const len = +cigarOps[i]!
    if (op === 'S') {
      for (let k = 0; k < len; k++) {
        const base = seq[seqOffset + k]!
        const s0 = feature.get('start') - (i === 0 ? len : 0) + refOffset + k
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
      seqOffset += len
    }
    if (op === 'N') {
      refOffset += len
    }
    if (op === 'M' || op === '=' || op === 'X') {
      refOffset += len
      seqOffset += len
    }
    if (op === 'H') {
      // do nothing
    }
    if (op === 'D') {
      refOffset += len
    }
    if (op === 'I') {
      seqOffset += len
    }
  }
}
