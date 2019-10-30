import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { bpToPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useState, useCallback } from 'react'
import FeatureGlyph from './FeatureGlyph'
import { chooseGlyphComponent, layOut } from './util'

const fontWidthScaleFactor = 0.55
const renderingStyle = {
  position: 'relative',
}
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

  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] = useState(
    false,
  )
  const {
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onClick,
  } = props

  const mouseDown = useCallback(
    event => {
      setMouseIsDown(true)
      setMovedDuringLastMouseDown(false)
      const handler = onMouseDown
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseDown],
  )

  const mouseUp = useCallback(
    event => {
      setMouseIsDown(false)
      const handler = onMouseUp
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseUp],
  )

  const mouseEnter = useCallback(
    event => {
      const handler = onMouseEnter
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseEnter],
  )

  const mouseLeave = useCallback(
    event => {
      const handler = onMouseLeave
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseLeave],
  )

  const mouseOver = useCallback(
    event => {
      const handler = onMouseOver
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseOver],
  )

  const mouseOut = useCallback(
    event => {
      const handler = onMouseOut
      if (!handler) return undefined
      return handler(event)
    },
    [onMouseOut],
  )

  const mouseMove = useCallback(
    event => {
      const handler = onMouseMove
      if (mouseIsDown) setMovedDuringLastMouseDown(true)
      if (!handler) return undefined
      return handler(event)
    },
    [mouseIsDown, onMouseMove],
  )

  const click = useCallback(
    event => {
      const handler = onClick
      if (!handler || movedDuringLastMouseDown) return undefined
      return handler(event)
    },
    [movedDuringLastMouseDown, onClick],
  )

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
      const aboveLayout = shouldShowName
        ? rootLayout.getSubRecord('nameLabel')
        : featureLayout
      descriptionWidth = Math.round(
        Math.min(description.length * fontWidth, rootLayout.width + exp),
      )
      rootLayout.addChild(
        'descriptionLabel',
        0,
        aboveLayout.bottom + textVerticalPadding,
        descriptionWidth,
        fontHeight,
      )
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
        selected={String(selectedFeatureId) === String(feature.id())}
        config={config}
        name={name}
        shouldShowName={shouldShowName}
        description={description}
        shouldShowDescription={shouldShowDescription}
        fontHeight={fontHeight}
        allowedWidthExpansion={exp}
        movedDuringLastMouseDown={movedDuringLastMouseDown}
        {...props}
      />
    )
  }

  const featuresRendered = []
  for (const feature of features.values()) {
    const ret = createFeatureGlyphComponent(feature)
    if (ret) featuresRendered.push(ret)
  }

  const width = (region.end - region.start) / bpPerPx
  const height = layout.getTotalHeight()

  return (
    <svg
      className="SvgFeatureRendering"
      width={`${width}px`}
      height={`${height}px`}
      style={renderingStyle}
      onMouseDown={mouseDown}
      onMouseUp={mouseUp}
      onMouseEnter={mouseEnter}
      onMouseLeave={mouseLeave}
      onMouseOver={mouseOver}
      onMouseOut={mouseOut}
      onMouseMove={mouseMove}
      onFocus={mouseEnter}
      onBlur={mouseLeave}
      onClick={click}
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
  onMouseMove: ReactPropTypes.func,
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
  onMouseMove: undefined,
  onClick: undefined,
}

export default observer(SvgFeatureRendering)
