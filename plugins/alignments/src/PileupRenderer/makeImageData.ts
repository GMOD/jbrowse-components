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
      canvasWidth,
      charHeight,
      charWidth,
      colorForBase,
      contrastForBase,
      ctx,
      defaultColor,
      feat,
      renderArgs,
    })
    renderMismatches({
      canvasWidth,
      charHeight,
      charWidth,
      colorForBase,
      contrastForBase,
      ctx,
      drawIndels,
      drawSNPsMuted,
      feat,
      largeInsertionIndicatorScale,
      minSubfeatureWidth,
      mismatchAlpha,
      renderArgs,
    })
    if (showSoftClip) {
      renderSoftClipping({
        canvasWidth,
        colorForBase,
        config,
        ctx,
        feat,
        renderArgs,
        theme,
      })
    }
  }
}
