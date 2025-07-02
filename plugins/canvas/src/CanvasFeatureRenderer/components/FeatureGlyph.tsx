import { readConfObject } from '@jbrowse/core/configuration'

import { drawFeatureLabel } from './FeatureLabel'

import type { DisplayModel } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const FeatureGlyph = function (props: {
  feature: Feature
  rootLayout: SceneGraph
  config: AnyConfigurationModel
  name: string
  description: string
  shouldShowName: boolean
  shouldShowDescription: boolean
  colorByCDS: boolean
  fontHeight: number
  allowedWidthExpansion: number
  exportSVG?: unknown
  displayModel?: DisplayModel
  selected?: boolean
  topLevel?: boolean
  region: Region
  viewParams: {
    end: number
    start: number
    offsetPx: number
    offsetPx1: number
  }
  bpPerPx: number
  ctx: CanvasRenderingContext2D
}) {
  const {
    feature,
    rootLayout,
    config,
    name,
    description,
    shouldShowName,
    shouldShowDescription,
    ctx,
    region,
    bpPerPx,
    colorByCDS,
    selected,
    topLevel,
    viewParams,
    fontHeight,
    allowedWidthExpansion,
  } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  }
  const { GlyphComponent } = featureLayout.data || {}
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  // Call the GlyphComponent's draw method
  GlyphComponent.draw({
    feature,
    x: left,
    y: top,
    width,
    height,
    config,
    region,
    bpPerPx,
    colorByCDS,
    selected,
    topLevel,
    ctx,
  })

  if (shouldShowName) {
    drawFeatureLabel({
      text: name,
      x: rootLayout.getSubRecord('nameLabel')?.absolute.left || 0,
      y: rootLayout.getSubRecord('nameLabel')?.absolute.top || 0,
      color: readConfObject(config, ['labels', 'nameColor'], { feature }),
      featureWidth: featureLayout.width,
      feature,
      region,
      bpPerPx,
      exportSVG: props.exportSVG,
      displayModel: props.displayModel,
      viewParams,
      fontHeight,
      allowedWidthExpansion,
      ctx,
    })
  }

  if (shouldShowDescription) {
    drawFeatureLabel({
      text: description,
      x: rootLayout.getSubRecord('descriptionLabel')?.absolute.left || 0,
      y: rootLayout.getSubRecord('descriptionLabel')?.absolute.top || 0,
      color: readConfObject(config, ['labels', 'descriptionColor'], {
        feature,
      }),
      featureWidth: featureLayout.width,
      feature,
      region,
      bpPerPx,
      exportSVG: props.exportSVG,
      displayModel: props.displayModel,
      viewParams,
      fontHeight,
      allowedWidthExpansion,
      ctx,
    })
  }

  return null // This component now only draws, it doesn't render JSX elements
}

export default FeatureGlyph
