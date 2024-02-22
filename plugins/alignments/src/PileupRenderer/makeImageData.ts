import { Feature } from '@jbrowse/core/util'
import { RenderArgsDeserializedWithFeaturesAndLayout } from './PileupRenderer'
import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from './util'
import { renderAlignment } from './renderAlignment'
import { renderMismatches } from './renderMismatches'
import { renderSoftClipping } from './renderSoftClipping'

export type RenderArgsWithColor = RenderArgsDeserializedWithFeaturesAndLayout

interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

export function makeImageData({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  layoutRecords: LayoutFeature[]
  renderArgs: RenderArgsWithColor
}) {
  const { config, showSoftClip, colorBy, theme: configTheme } = renderArgs
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth')
  const largeInsertionIndicatorScale = readConfObject(
    config,
    'largeInsertionIndicatorScale',
  )
  const defaultColor = readConfObject(config, 'color') === '#f0f'
  const theme = createJBrowseTheme(configTheme)
  const colorForBase = getColorBaseMap(theme)
  const contrastForBase = getContrastBaseMap(theme)
  ctx.font = 'bold 10px Courier New,monospace'

  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy?.type)
  const drawIndels = shouldDrawIndels()
  for (const feat of layoutRecords) {
    renderAlignment({
      ctx,
      feat,
      renderArgs,
      defaultColor,
      colorForBase,
      contrastForBase,
      charWidth,
      charHeight,
      canvasWidth,
    })
    renderMismatches({
      ctx,
      feat,
      renderArgs,
      mismatchAlpha,
      drawSNPsMuted,
      drawIndels,
      largeInsertionIndicatorScale,
      minSubfeatureWidth,
      charWidth,
      charHeight,
      colorForBase,
      contrastForBase,
      canvasWidth,
    })
    if (showSoftClip) {
      renderSoftClipping({
        ctx,
        feat,
        renderArgs,
        colorForBase,
        config,
        theme,
        canvasWidth,
      })
    }
  }
}
