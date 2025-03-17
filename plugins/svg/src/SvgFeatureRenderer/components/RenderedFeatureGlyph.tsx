import { readConfObject } from '@jbrowse/core/configuration'
import { bpToPx, measureText } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'

import FeatureGlyph from './FeatureGlyph'
import { chooseGlyphComponent } from './chooseGlyphComponent'
import { layOut } from './util'

import type { DisplayModel, ExtraGlyphValidator, ViewParams } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

// used to make features have a little padding for their labels
const xPadding = 3
const yPadding = 5

export default function RenderedFeatureGlyph(props: {
  feature: Feature
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  colorByCDS: boolean
  layout: BaseLayout<unknown>
  extraGlyphs?: ExtraGlyphValidator[]
  displayMode: string
  exportSVG?: unknown
  displayModel?: DisplayModel
  detectRerender?: () => void
  viewParams: ViewParams
  [key: string]: unknown
}) {
  const {
    feature,
    detectRerender,
    bpPerPx,
    region,
    config,
    displayMode,
    layout,
    extraGlyphs,
  } = props

  // used for unit testing, difficult to mock out so it is in actual source code
  detectRerender?.()

  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)
  const labelAllowed = displayMode !== 'collapsed'

  const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
  const GlyphComponent = chooseGlyphComponent({
    config,
    feature,
    extraGlyphs,
  })
  const featureLayout = (GlyphComponent.layOut || layOut)({
    layout: rootLayout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  let shouldShowName = false
  let shouldShowDescription = false
  let name = ''
  let description = ''
  let fontHeight = 0
  let expansion = 0
  if (labelAllowed) {
    const showLabels = readConfObject(config, 'showLabels')
    const showDescriptions = readConfObject(config, 'showDescriptions')
    fontHeight = readConfObject(config, ['labels', 'fontSize'], { feature })
    expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    name = String(readConfObject(config, ['labels', 'name'], { feature }) || '')
    shouldShowName = /\S/.test(name) && showLabels

    const getWidth = (text: string) => {
      const glyphWidth = rootLayout.width + expansion
      const textWidth = measureText(text, fontHeight)
      return Math.round(Math.min(textWidth, glyphWidth))
    }

    description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )
    shouldShowDescription = /\S/.test(description) && showDescriptions

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

  const topPx = layout.addRect(
    feature.id(),
    feature.get('start'),
    feature.get('start') + rootLayout.width * bpPerPx + xPadding * bpPerPx,
    rootLayout.height + yPadding,
  )
  if (topPx === null) {
    return null
  }
  rootLayout.move(startPx, topPx)

  return (
    <FeatureGlyph
      rootLayout={rootLayout}
      name={name}
      shouldShowName={shouldShowName}
      description={description}
      shouldShowDescription={shouldShowDescription}
      fontHeight={fontHeight}
      allowedWidthExpansion={expansion}
      reversed={region.reversed}
      topLevel={true}
      {...props}
    />
  )
}
