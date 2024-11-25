import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

// locals
import FeatureLabel from './FeatureLabel'
import type { DisplayModel } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const FeatureGlyph = observer(function (props: {
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
  reversed?: boolean
  topLevel?: boolean
  region: Region
  viewParams: {
    end: number
    start: number
    offsetPx: number
    offsetPx1: number
  }
  bpPerPx: number
}) {
  const {
    feature,
    rootLayout,
    config,
    name,
    description,
    shouldShowName,
    shouldShowDescription,
  } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  }
  const { GlyphComponent } = featureLayout.data || {}

  return (
    <g>
      <GlyphComponent featureLayout={featureLayout} {...props} />
      {shouldShowName ? (
        <FeatureLabel
          text={name}
          x={rootLayout.getSubRecord('nameLabel')?.absolute.left || 0}
          y={rootLayout.getSubRecord('nameLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'nameColor'], { feature })}
          featureWidth={featureLayout.width}
          {...props}
        />
      ) : null}
      {shouldShowDescription ? (
        <FeatureLabel
          text={description}
          x={rootLayout.getSubRecord('descriptionLabel')?.absolute.left || 0}
          y={rootLayout.getSubRecord('descriptionLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'descriptionColor'], {
            feature,
          })}
          featureWidth={featureLayout.width}
          {...props}
        />
      ) : null}
    </g>
  )
})

export default FeatureGlyph
