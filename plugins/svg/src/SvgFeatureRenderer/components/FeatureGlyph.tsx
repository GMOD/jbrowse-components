import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import FeatureLabel from './FeatureLabel'
import { Feature } from '@jbrowse/core/util/simpleFeature'

function FeatureGlyph(props: {
  feature: Feature
  rootLayout: any
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
  const { GlyphComponent } = featureLayout.data

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
          x={rootLayout.getSubRecord('nameLabel').absolute.left}
          y={rootLayout.getSubRecord('nameLabel').absolute.top}
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
          x={rootLayout.getSubRecord('descriptionLabel').absolute.left}
          y={rootLayout.getSubRecord('descriptionLabel').absolute.top}
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
