import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { layoutFeats } from './layoutFeatures.ts'
import { renderAlignment } from './renderers/renderAlignment.ts'
import { renderMismatchesCallback } from './renderers/renderMismatchesCallback.ts'
import { renderSoftClipping } from './renderers/renderSoftClipping.ts'
import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  setAlignmentFont,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from '../shared/util.ts'

import type {
  FlatbushItem,
  LayoutFeature,
  PreProcessedRenderArgs,
  ProcessedRenderArgs,
} from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

async function fetchRegionSequence(
  renderArgs: PreProcessedRenderArgs,
  pluginManager: PluginManager,
) {
  const { colorBy, features, sessionId, regions, adapterConfig } = renderArgs
  if (colorBy?.type !== 'methylation' || !features.size) {
    return undefined
  }
  // Get the BAM/CRAM adapter to access its cached sequenceAdapterConfig
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const sequenceAdapterConfig = (
    dataAdapter as { sequenceAdapterConfig?: Record<string, unknown> }
  ).sequenceAdapterConfig
  if (!sequenceAdapterConfig) {
    return undefined
  }
  const { dataAdapter: seqAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    sequenceAdapterConfig,
  )
  const region = regions[0]!
  return (seqAdapter as BaseSequenceAdapter).getSequence({
    ...region,
    refName: region.originalRefName || region.refName,
    start: Math.max(0, region.start - 1),
    end: region.end + 1,
  })
}

function renderFeatures({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  layoutRecords: LayoutFeature[]
  renderArgs: ProcessedRenderArgs
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
  const hideSmallIndels = readConfObject(config, 'hideSmallIndels') as boolean
  const hideMismatches = readConfObject(config, 'hideMismatches') as boolean
  const hideLargeIndels = readConfObject(config, 'hideLargeIndels') as boolean
  const defaultColor = readConfObject(config, 'color') === '#f0f'
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  setAlignmentFont(ctx)

  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy?.type)
  const drawIndels = shouldDrawIndels()
  const coords = [] as number[]
  const items = [] as FlatbushItem[]
  const lastCheck = createStopTokenChecker(stopToken)

  for (const feat of layoutRecords) {
    const alignmentRet = renderAlignment({
      ctx,
      feat,
      renderArgs,
      defaultColor,
      colorMap,
      colorContrastMap,
      charWidth,
      charHeight,
      canvasWidth,
    })
    for (let i = 0, l = alignmentRet.coords.length; i < l; i++) {
      coords.push(alignmentRet.coords[i]!)
    }
    for (let i = 0, l = alignmentRet.items.length; i < l; i++) {
      items.push(alignmentRet.items[i]!)
    }
    const ret = renderMismatchesCallback({
      ctx,
      feat,
      bpPerPx: renderArgs.bpPerPx,
      regions: renderArgs.regions,
      hideSmallIndels,
      hideMismatches,
      hideLargeIndels,
      mismatchAlpha,
      drawSNPsMuted,
      drawIndels,
      largeInsertionIndicatorScale,
      minSubfeatureWidth,
      charWidth,
      charHeight,
      colorMap,
      colorContrastMap,
      canvasWidth,
    })
    for (let i = 0, l = ret.coords.length; i < l; i++) {
      coords.push(ret.coords[i]!)
    }
    for (let i = 0, l = ret.items.length; i < l; i++) {
      items.push(ret.items[i]!)
    }
    if (showSoftClip) {
      renderSoftClipping({
        ctx,
        feat,
        renderArgs,
        colorMap,
        config,
        theme,
        canvasWidth,
      })
    }
    checkStopToken2(lastCheck)
  }

  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
  }
}

export async function makeImageData({
  width,
  renderArgs,
  pluginManager,
}: {
  width: number
  renderArgs: PreProcessedRenderArgs
  pluginManager: PluginManager
}) {
  const { statusCallback = () => {}, features } = renderArgs

  statusCallback('Creating layout')
  const { layoutRecords, height } = layoutFeats(renderArgs)

  statusCallback('Fetching sequence')
  const regionSequence = await fetchRegionSequence(renderArgs, pluginManager)

  statusCallback('Rendering alignments')
  const result = await renderToAbstractCanvas(width, height, renderArgs, ctx =>
    renderFeatures({
      ctx,
      layoutRecords,
      canvasWidth: width,
      renderArgs: {
        ...renderArgs,
        regionSequence,
      },
    }),
  )

  const featureNames: Record<string, string> = {}
  for (const [id, feature] of features) {
    const name = feature.get('name')
    if (name) {
      featureNames[id] = name
    }
  }

  return { result, height, featureNames }
}
