import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { drawFeature } from './drawFeature'
import {
  addSubfeaturesToLayoutAndFlatbush,
  adjustChildPositions,
} from './layoutUtils'
import { buildFeatureTooltip } from './util'

import type { RenderConfigContext } from './renderConfig'
import type {
  FlatbushItem,
  LayoutRecord,
  RenderArgs,
  SubfeatureInfo,
} from './types'

function buildFlatbush(coords: number[], count: number) {
  const fb = new Flatbush(Math.max(count, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      fb.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    fb.add(0, 0, 0, 0)
  }
  fb.finish()
  return fb
}

export function makeImageData({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
  configContext,
}: {
  ctx: CanvasRenderingContext2D
  layoutRecords: LayoutRecord[]
  canvasWidth: number
  renderArgs: RenderArgs
  configContext: RenderConfigContext
}) {
  const {
    config,
    bpPerPx,
    regions,
    theme: configTheme,
    stopToken,
    layout,
    peptideDataMap,
    colorByCDS,
    pluginManager,
  } = renderArgs
  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)

  const coords: number[] = []
  const items: FlatbushItem[] = []
  const subfeatureCoords: number[] = []
  const subfeatureInfos: SubfeatureInfo[] = []

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const { subfeatureLabels, transcriptTypes } = configContext
  const lastCheck = { time: Date.now() }
  let idx = 0

  for (const record of layoutRecords) {
    const {
      feature,
      layout: featureLayout,
      topPx: recordTopPx,
      label,
      description,
    } = record

    const start = feature.get(region.reversed ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx)

    const adjustedLayout = {
      ...featureLayout,
      x: startPx + featureLayout.x,
      y: recordTopPx + featureLayout.y,
      children: adjustChildPositions(
        featureLayout.children,
        startPx,
        recordTopPx,
      ),
    }

    drawFeature({
      ctx,
      feature,
      featureLayout: adjustedLayout,
      region,
      bpPerPx,
      config,
      configContext,
      theme,
      reversed: region.reversed || false,
      topLevel: true,
      canvasWidth,
      peptideDataMap,
      colorByCDS,
      pluginManager,
    })

    const featureType = feature.get('type')
    const isGene = featureType === 'gene'
    const hasTranscriptChildren = adjustedLayout.children.some(child => {
      const childType = child.feature.get('type')
      return transcriptTypes.includes(childType)
    })

    const featureStartBp = feature.get('start')
    const featureEndBp = feature.get('end')
    const leftPx = adjustedLayout.x
    const rightPx = adjustedLayout.x + adjustedLayout.totalLayoutWidth
    const topPx = adjustedLayout.y
    const bottomPx = adjustedLayout.y + adjustedLayout.totalLayoutHeight

    const tooltip = buildFeatureTooltip({
      mouseOver: feature.get('_mouseOver') as string | undefined,
      label: label || undefined,
      description: description || undefined,
    })

    coords.push(leftPx, topPx, rightPx, bottomPx)
    items.push({
      featureId: feature.id(),
      type: 'box',
      startBp: featureStartBp,
      endBp: featureEndBp,
      leftPx,
      rightPx,
      topPx,
      bottomPx,
      tooltip,
    })

    if (isGene && hasTranscriptChildren) {
      addSubfeaturesToLayoutAndFlatbush({
        layout,
        featureLayout: adjustedLayout,
        parentFeatureId: feature.id(),
        subfeatureCoords,
        subfeatureInfos,
        config,
        subfeatureLabels,
        transcriptTypes,
        labelColor: theme.palette.text.primary,
      })
    }
    checkStopToken2(stopToken, idx++, lastCheck)
  }

  return {
    flatbush: buildFlatbush(coords, items.length).data,
    items,
    subfeatureFlatbush: buildFlatbush(subfeatureCoords, subfeatureInfos.length)
      .data,
    subfeatureInfos,
  }
}
