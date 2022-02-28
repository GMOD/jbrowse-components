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
}) {
  const {
    feature,
    rootLayout,
    selected,
    config,
    name = '',
    description = '',
    shouldShowName,
    shouldShowDescription,
    fontHeight,
    allowedWidthExpansion,
    reversed,
  } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  const { GlyphComponent } = featureLayout.data

  const glyphComponents = [
    <GlyphComponent
      key={`glyph-${feature.id()}`}
      {...props}
      feature={feature}
      featureLayout={featureLayout}
      selected={selected}
    />,
  ]

  if (shouldShowName) {
    glyphComponents.push(
      <FeatureLabel
        key={`glyph-name-${feature.id()}`}
        text={name}
        x={rootLayout.getSubRecord('nameLabel').absolute.left}
        y={rootLayout.getSubRecord('nameLabel').absolute.top}
        color={readConfObject(config, ['labels', 'nameColor'], { feature })}
        fontHeight={fontHeight}
        reversed={reversed}
        featureWidth={featureLayout.width}
        allowedWidthExpansion={allowedWidthExpansion}
      />,
    )
  }

  if (shouldShowDescription) {
    glyphComponents.push(
      <FeatureLabel
        key={`glyph-description-${feature.id()}`}
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
      />,
    )
  }

  return <g>{glyphComponents}</g>
}

export default observer(FeatureGlyph)
