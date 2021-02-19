import { readConfObject } from '@jbrowse/core/configuration'
import { PropTypes as CommonPropTypes } from '@jbrowse/core/util/types/mst'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import FeatureLabel from './FeatureLabel'

function FeatureGlyph(props) {
  const {
    feature,
    rootLayout,
    selected,
    config,
    name,
    shouldShowName,
    description,
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

FeatureGlyph.propTypes = {
  feature: PropTypes.shape({
    id: PropTypes.func.isRequired,
    get: PropTypes.func.isRequired,
  }).isRequired,
  layout: PropTypes.shape({
    addRect: PropTypes.func.isRequired,
    getTotalHeight: PropTypes.func.isRequired,
  }).isRequired,
  rootLayout: PropTypes.shape({
    addChild: PropTypes.func.isRequired,
    getSubRecord: PropTypes.func.isRequired,
  }).isRequired,
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: PropTypes.number.isRequired,
  reversed: PropTypes.bool,
  selected: PropTypes.bool,
  config: CommonPropTypes.ConfigSchema.isRequired,
  name: PropTypes.string,
  shouldShowName: PropTypes.bool,
  description: PropTypes.string,
  shouldShowDescription: PropTypes.bool,
  fontHeight: PropTypes.number,
  allowedWidthExpansion: PropTypes.number,
  movedDuringLastMouseDown: PropTypes.bool.isRequired,
}

FeatureGlyph.defaultProps = {
  reversed: false,
  selected: false,
  name: '',
  shouldShowName: false,
  description: '',
  shouldShowDescription: false,
  fontHeight: undefined,
  allowedWidthExpansion: undefined,
}

export default observer(FeatureGlyph)
