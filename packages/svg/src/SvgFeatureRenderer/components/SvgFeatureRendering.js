import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { bpToPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import FeatureGlyph from './FeatureGlyph'
import { chooseGlyphComponent, layOut } from './util'

const fontWidthScaleFactor = 0.55

function SvgFeatureRendering(props) {
  const {
    region,
    bpPerPx,
    layout,
    horizontallyFlipped,
    config,
    features,
    trackModel: { selectedFeatureId },
  } = props

  function onMouseDown(event) {
    const { onMouseDown: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function onMouseUp(event) {
    const { onMouseUp: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function onMouseEnter(event) {
    const { onMouseEnter: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function onMouseLeave(event) {
    const { onMouseLeave: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function onMouseOver(event) {
    const { onMouseOver: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function onMouseOut(event) {
    const { onMouseOut: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function onClick(event) {
    const { onClick: handler } = props
    if (!handler) return undefined
    return handler(event)
  }

  function createFeatureGlyphComponent(feature) {
    const start = feature.get(horizontallyFlipped ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx, horizontallyFlipped)
    const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
    const GlyphComponent = chooseGlyphComponent(feature)
    const featureLayout = (GlyphComponent.layOut || layOut)({
      layout: rootLayout,
      feature,
      bpPerPx,
      horizontallyFlipped,
      config,
    })

    const fontHeight = readConfObject(
      config,
      ['labels', 'fontSize'],
      ['feature'],
    )
    const fontWidth = fontHeight * fontWidthScaleFactor
    const exp = readConfObject(config, 'maxFeatureGlyphExpansion') || 0
    const textVerticalPadding = 2

    const name = readConfObject(config, ['labels', 'name'], [feature]) || ''
    const shouldShowName = /\S/.test(name)
    let nameWidth = 0
    if (shouldShowName) {
      nameWidth = Math.round(
        Math.min(name.length * fontWidth, rootLayout.width + exp),
      )
      rootLayout.addChild(
        'nameLabel',
        0,
        featureLayout.bottom + textVerticalPadding,
        nameWidth,
        fontHeight,
      )
    }

    const description =
      readConfObject(config, ['labels', 'description'], [feature]) || ''
    const shouldShowDescription = /\S/.test(description)
    let descriptionWidth = 0
    if (shouldShowDescription) {
      descriptionWidth = Math.round(
        Math.min(description.length * fontWidth, rootLayout.width + exp),
      )
      rootLayout.addChild(
        'descriptionLabel',
        0,
        rootLayout.getSubRecord(shouldShowName ? 'nameLabel' : 'feature')
          .bottom + textVerticalPadding,
        descriptionWidth,
        fontHeight,
      )
    }

    const topPx = layout.addRect(
      feature.id(),
      start,
      start + rootLayout.width * bpPerPx,
      rootLayout.height,
    )

    rootLayout.move(startPx, topPx)

    return (
      <FeatureGlyph
        key={`svg-feature-${feature.id()}`}
        feature={feature}
        layout={layout}
        rootLayout={rootLayout}
        bpPerPx={bpPerPx}
        selected={String(selectedFeatureId) === String(feature.id())}
        config={config}
        name={name}
        shouldShowName={shouldShowName}
        description={description}
        shouldShowDescription={shouldShowDescription}
        fontHeight={fontHeight}
        allowedWidthExpansion={exp}
        {...props}
      />
    )
  }

  const featuresRendered = []
  for (const feature of features.values()) {
    featuresRendered.push(createFeatureGlyphComponent(feature))
  }

  const width = (region.end - region.start) / bpPerPx
  const height = layout.getTotalHeight()

  return (
    <svg
      className="SvgFeatureRendering"
      width={`${width}px`}
      height={`${height}px`}
      style={{
        position: 'relative',
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onFocus={onMouseEnter}
      onBlur={onMouseLeave}
      onClick={onClick}
    >
      {featuresRendered}
    </svg>
  )
}

SvgFeatureRendering.propTypes = {
  layout: ReactPropTypes.shape({
    addRect: ReactPropTypes.func.isRequired,
    getTotalHeight: ReactPropTypes.func.isRequired,
  }).isRequired,

  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  horizontallyFlipped: ReactPropTypes.bool,
  features: ReactPropTypes.oneOfType([
    ReactPropTypes.instanceOf(Map),
    ReactPropTypes.arrayOf(ReactPropTypes.shape()),
  ]),
  config: CommonPropTypes.ConfigSchema.isRequired,
  trackModel: ReactPropTypes.shape({
    /** id of the currently selected feature, if any */
    selectedFeatureId: ReactPropTypes.string,
  }),

  onMouseDown: ReactPropTypes.func,
  onMouseUp: ReactPropTypes.func,
  onMouseEnter: ReactPropTypes.func,
  onMouseLeave: ReactPropTypes.func,
  onMouseOver: ReactPropTypes.func,
  onMouseOut: ReactPropTypes.func,
  onClick: ReactPropTypes.func,
}

SvgFeatureRendering.defaultProps = {
  horizontallyFlipped: false,

  trackModel: {},

  features: new Map(),

  onMouseDown: undefined,
  onMouseUp: undefined,
  onMouseEnter: undefined,
  onMouseLeave: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onClick: undefined,
}

export default observer(SvgFeatureRendering)
