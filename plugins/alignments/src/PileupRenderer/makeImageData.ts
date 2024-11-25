import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { renderAlignment } from './renderAlignment'
import { renderMismatches } from './renderMismatches'
import { renderSoftClipping } from './renderSoftClipping'
import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from './util'
import type { RenderArgsDeserializedWithFeaturesAndLayout } from './PileupRenderer'
import type { Feature } from '@jbrowse/core/util'

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
  const {
    stopToken,
    config,
    showSoftClip,
    colorBy,
    theme: configTheme,
  } = renderArgs
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
  let start = performance.now()
  for (const feat of layoutRecords) {
    if (performance.now() - start > 400) {
      checkStopToken(stopToken)
      start = performance.now()
    }
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
  return undefined
}
