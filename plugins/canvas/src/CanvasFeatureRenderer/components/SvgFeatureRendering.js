import { readConfObject } from '@jbrowse/core/configuration'
import { PropTypes as CommonPropTypes } from '@jbrowse/core/util/types/mst'
import { bpToPx, measureText } from '@jbrowse/core/util'
import SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import FeatureGlyph from './FeatureGlyph'
import SvgOverlay from './SvgOverlay'
import { chooseGlyphComponent, layOut } from './util'

const renderingStyle = {
  position: 'relative',
}

// used to make features have a little padding for their labels
const nameWidthPadding = 2
const textVerticalPadding = 2

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const svgHeightPadding = 100

function RenderedFeatureGlyph(props) {
  const { feature, bpPerPx, region, config, displayMode, layout } = props
  const { reversed } = region
  const start = feature.get(reversed ? 'end' : 'start')
  const startPx = bpToPx(start, region, bpPerPx)
  const labelsAllowed = displayMode !== 'compact' && displayMode !== 'collapsed'

  const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
  const GlyphComponent = chooseGlyphComponent(feature)
  const featureLayout = (GlyphComponent.layOut || layOut)({
    layout: rootLayout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  let shouldShowName
  let shouldShowDescription
  let name
  let description
  let fontHeight
  let expansion
  if (labelsAllowed) {
    const showLabels = readConfObject(config, 'showLabels')
    const showDescriptions = readConfObject(config, 'showDescriptions')
    fontHeight = readConfObject(config, ['labels', 'fontSize'], { feature })
    expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    name = readConfObject(config, ['labels', 'name'], { feature }) || ''
    shouldShowName = /\S/.test(name) && showLabels

    description =
      readConfObject(config, ['labels', 'description'], { feature }) || ''
    shouldShowDescription =
      /\S/.test(description) && showLabels && showDescriptions

    let nameWidth = 0
    if (shouldShowName) {
      nameWidth =
        Math.round(
          Math.min(measureText(name, fontHeight), rootLayout.width + expansion),
        ) + nameWidthPadding
      rootLayout.addChild(
        'nameLabel',
        0,
        featureLayout.bottom + textVerticalPadding,
        nameWidth,
        fontHeight,
      )
    }

    let descriptionWidth = 0
    if (shouldShowDescription) {
      const aboveLayout = shouldShowName
        ? rootLayout.getSubRecord('nameLabel')
        : featureLayout
      descriptionWidth =
        Math.round(
          Math.min(
            measureText(description, fontHeight),
            rootLayout.width + expansion,
          ),
        ) + nameWidthPadding
      rootLayout.addChild(
        'descriptionLabel',
        0,
        aboveLayout.bottom + textVerticalPadding,
        descriptionWidth,
        fontHeight,
      )
    }
  }

  const topPx = layout.addRect(
    feature.id(),
    feature.get('start'),
    feature.get('start') + rootLayout.width * bpPerPx,
    rootLayout.height,
  )
  if (topPx === null) {
    return null
  }
  rootLayout.move(startPx, topPx)

  return (
    <FeatureGlyph
      key={`svg-feature-${feature.id()}`}
      feature={feature}
      layout={layout}
      rootLayout={rootLayout}
      bpPerPx={bpPerPx}
      config={config}
      name={String(name)}
      shouldShowName={shouldShowName}
      description={String(description)}
      shouldShowDescription={shouldShowDescription}
      fontHeight={fontHeight}
      allowedWidthExpansion={expansion}
      reversed={region.reversed}
      {...props}
    />
  )
}

RenderedFeatureGlyph.propTypes = {
  layout: ReactPropTypes.shape({
    addRect: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,

  displayMode: ReactPropTypes.string.isRequired,
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({
    id: ReactPropTypes.func.isRequired,
    get: ReactPropTypes.func.isRequired,
  }).isRequired,
  config: CommonPropTypes.ConfigSchema.isRequired,
}

const RenderedFeatures = observer(props => {
  const { features } = props
  const featuresRendered = []
  for (const feature of features.values()) {
    featuresRendered.push(
      <RenderedFeatureGlyph key={feature.id()} feature={feature} {...props} />,
    )
  }
  return <>{featuresRendered}</>
})
RenderedFeatures.propTypes = {
  features: ReactPropTypes.oneOfType([
    ReactPropTypes.instanceOf(Map),
    ReactPropTypes.arrayOf(ReactPropTypes.shape()),
  ]),
  layout: ReactPropTypes.shape({
    addRect: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,
}

RenderedFeatures.defaultProps = {
  features: [],
}

function SvgFeatureRendering(props) {
  return 'hello'
}

export default observer(SvgFeatureRendering)
