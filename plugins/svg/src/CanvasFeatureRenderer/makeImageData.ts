import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  bpToPx,
  forEachWithStopTokenCheck,
  measureText,
} from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawFeature } from './drawFeature'
import { getSubparts } from './filterSubparts'
import { chooseGlyphType, getBoxColor } from './util'
import { layOut, layOutProcessedTranscript } from './layoutUtils'

import type { LayoutRecord, RenderArgs } from './types'
import type { Feature } from '@jbrowse/core/util'

const xPadding = 3
const yPadding = 5

/**
 * Render features to a canvas context and return spatial index data
 */
export function makeImageData({
  ctx,
  layoutRecords,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  layoutRecords: LayoutRecord[]
  renderArgs: RenderArgs
}) {
  const { config, bpPerPx, regions, theme: configTheme, stopToken } = renderArgs
  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)
  const displayMode = readConfObject(config, 'displayMode') as string
  const canvasWidth = (region.end - region.start) / bpPerPx

  const coords: number[] = []
  const items: { feature: Feature; type: string }[] = []

  // Set default canvas styles
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  forEachWithStopTokenCheck(layoutRecords, stopToken, record => {
    const { feature, rootLayout, topPx } = record

    // Draw the feature
    const featureLayout = rootLayout.getSubRecord(String(feature.id()))
    if (!featureLayout) {
      return
    }

    // Position the root layout at the computed position
    const start = feature.get(region.reversed ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx)
    rootLayout.move(startPx, topPx)

    const result = drawFeature({
      ctx,
      feature,
      featureLayout,
      region,
      bpPerPx,
      config,
      theme,
      reversed: region.reversed || false,
      topLevel: true,
      canvasWidth,
    })

    coords.push(...result.coords)
    items.push(...result.items)

    // Draw labels if allowed
    const labelAllowed = displayMode !== 'collapsed'
    if (labelAllowed) {
      const showLabels = readConfObject(config, 'showLabels')
      const showDescriptions = readConfObject(config, 'showDescriptions')
      const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
        feature,
      })

      const name = String(
        readConfObject(config, ['labels', 'name'], { feature }) || '',
      )
      const shouldShowName = /\S/.test(name) && showLabels

      const description = String(
        readConfObject(config, ['labels', 'description'], { feature }) || '',
      )
      const shouldShowDescription = /\S/.test(description) && showDescriptions

      const nameLabel = rootLayout.getSubRecord('nameLabel')
      const descriptionLabel = rootLayout.getSubRecord('descriptionLabel')

      if (shouldShowName && nameLabel) {
        const nameColor = readConfObject(config, ['labels', 'nameColor'], {
          feature,
        })
        ctx.fillStyle = nameColor
        ctx.font = `${fontHeight}px sans-serif`
        const { left = 0, top = 0, width = 0 } = nameLabel.absolute
        const text = measureText(name, fontHeight) > width ? name.slice(0, Math.floor(width / (fontHeight * 0.6))) + '...' : name
        ctx.fillText(text, left, top)
      }

      if (shouldShowDescription && descriptionLabel) {
        const descColor = readConfObject(
          config,
          ['labels', 'descriptionColor'],
          { feature },
        )
        ctx.fillStyle = descColor
        ctx.font = `${fontHeight}px sans-serif`
        const { left = 0, top = 0, width = 0 } = descriptionLabel.absolute
        const text = measureText(description, fontHeight) > width ? description.slice(0, Math.floor(width / (fontHeight * 0.6))) + '...' : description
        ctx.fillText(text, left, top)
      }
    }
  })

  // Create spatial index
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2]!, coords[i + 3]!)
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
  }
}

/**
 * Compute layouts for all features before rendering
 * This is called in the worker to pre-compute collision detection
 */
export function computeLayouts({
  features,
  bpPerPx,
  region,
  config,
  layout,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: any
  config: any
  layout: any
}): LayoutRecord[] {
  const displayMode = readConfObject(config, 'displayMode') as string
  const layoutRecords: LayoutRecord[] = []

  for (const feature of features.values()) {
    const reversed = region.reversed || false
    const labelAllowed = displayMode !== 'collapsed'

    const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
    const glyphType = chooseGlyphType({ config, feature })

    // Get appropriate layout function
    let featureLayout: SceneGraph
    if (glyphType === 'ProcessedTranscript') {
      const subfeatures = getSubparts(feature, config)
      featureLayout = layOutProcessedTranscript({
        layout: rootLayout,
        feature,
        bpPerPx,
        reversed,
        config,
        subfeatures,
      })
    } else {
      featureLayout = layOut({
        layout: rootLayout,
        feature,
        bpPerPx,
        reversed,
        config,
      })
    }

    let expansion = 0
    if (labelAllowed) {
      const showLabels = readConfObject(config, 'showLabels')
      const showDescriptions = readConfObject(config, 'showDescriptions')
      const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
        feature,
      })
      expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
      const name = String(
        readConfObject(config, ['labels', 'name'], { feature }) || '',
      )
      const shouldShowName = /\S/.test(name) && showLabels

      const getWidth = (text: string) => {
        const glyphWidth = rootLayout.width + expansion
        const textWidth = measureText(text, fontHeight)
        return Math.round(Math.min(textWidth, glyphWidth))
      }

      const description = String(
        readConfObject(config, ['labels', 'description'], { feature }) || '',
      )
      const shouldShowDescription = /\S/.test(description) && showDescriptions

      if (shouldShowName) {
        rootLayout.addChild(
          'nameLabel',
          0,
          featureLayout.bottom,
          getWidth(name),
          fontHeight,
        )
      }

      if (shouldShowDescription) {
        const aboveLayout = shouldShowName
          ? rootLayout.getSubRecord('nameLabel')
          : featureLayout
        if (!aboveLayout) {
          throw new Error('failed to layout nameLabel')
        }

        rootLayout.addChild(
          'descriptionLabel',
          0,
          aboveLayout.bottom,
          getWidth(description),
          fontHeight,
        )
      }
    }

    const start = feature.get(reversed ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx)
    const topPx = layout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('start') + rootLayout.width * bpPerPx + xPadding * bpPerPx,
      rootLayout.height + yPadding,
      {
        label: feature.get('name') || feature.get('id'),
        description: feature.get('description') || feature.get('note'),
        refName: feature.get('refName'),
      },
    )

    if (topPx !== null) {
      layoutRecords.push({
        feature,
        rootLayout,
        startPx,
        topPx,
      })
    }
  }

  return layoutRecords
}
