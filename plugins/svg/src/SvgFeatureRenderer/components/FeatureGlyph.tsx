import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import FeatureLabel from './FeatureLabel'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { SceneGraph } from '@jbrowse/core/util/layouts'

function FeatureGlyph(props: {
  feature: Feature
  rootLayout: SceneGraph
  config: AnyConfigurationModel
  name: string
  description: string
  shouldShowName: boolean
  shouldShowDescription: boolean
  fontHeight: number
  allowedWidthExpansion: number
  selected?: boolean
  reversed?: boolean
  topLevel?: boolean
}) {
  const {
    feature,
    rootLayout,
    selected,
    config,
    name,
    description,
    shouldShowName,
    shouldShowDescription,
    fontHeight,
    allowedWidthExpansion,
    reversed,
  } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  }
  const { GlyphComponent } = featureLayout.data || {}

  return (
    <g>
      <GlyphComponent
        key={`glyph-${feature.id()}`}
        featureLayout={featureLayout}
        selected={selected}
        {...props}
      />
      {shouldShowName ? (
        <FeatureLabel
          text={name}
          x={rootLayout.getSubRecord('nameLabel')?.absolute.left || 0}
          y={rootLayout.getSubRecord('nameLabel')?.absolute.top || 0}
          color={readConfObject(config, ['labels', 'nameColor'], { feature })}
          fontHeight={fontHeight}
          reversed={reversed}
          featureWidth={featureLayout.width}
          allowedWidthExpansion={allowedWidthExpansion}
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
          fontHeight={fontHeight}
          featureWidth={featureLayout.width}
          reversed={reversed}
          allowedWidthExpansion={allowedWidthExpansion}
        />
      ) : null}
    </g>
  )
}

export default observer(FeatureGlyph)
