import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import Box from './Box'
import Chevron from './Chevron'
import FeatureLabel from './FeatureLabel'

const fontWidthScaleFactor = 0.55

function layOut(args) {
  const { feature, bpPerPx, region, layout, horizontallyFlipped } = args

  const [startPx, endPx] = featureSpanPx(
    feature,
    region,
    bpPerPx,
    horizontallyFlipped,
  )
  const rootLayout = new SceneGraph('root', startPx, 0, 0, 0)
  const featureHeight = readConfObject(args.config, 'height', [feature])
  const featureWidth = endPx - startPx
  rootLayout.addChild('feature', 0, 0, featureWidth, featureHeight)

  const name = readConfObject(args.config, ['labels', 'name'], [feature]) || ''
  const description =
    readConfObject(args.config, ['labels', 'description'], [feature]) || ''
  const fontHeight = readConfObject(
    args.config,
    ['labels', 'fontSize'],
    ['feature'],
  )
  const fontWidth = fontHeight * fontWidthScaleFactor
  const shouldShowName = /\S/.test(name)
  const shouldShowDescription = /\S/.test(description)
  const textVerticalPadding = 2
  let labelWidth
  let descriptionWidth
  const maxFeatureGlyphExpansion = readConfObject(
    args.config,
    'maxFeatureGlyphExpansion',
  )
  if (shouldShowName) {
    labelWidth = Math.round(
      Math.min(
        name.length * fontWidth,
        featureWidth + maxFeatureGlyphExpansion,
      ),
    )

    rootLayout.addChild(
      'nameLabel',
      0,
      rootLayout.getSubRecord('feature').bottom + textVerticalPadding,
      labelWidth,
      fontHeight,
    )
  }
  if (shouldShowDescription) {
    descriptionWidth = Math.round(
      Math.min(
        description.length * fontWidth,
        featureWidth + maxFeatureGlyphExpansion,
      ),
    )
    rootLayout.addChild(
      'descriptionLabel',
      0,
      rootLayout.getSubRecord(shouldShowName ? 'nameLabel' : 'feature').bottom +
        textVerticalPadding,
      descriptionWidth,
      fontHeight,
    )
  }

  const start = feature.get('start')
  const topPx = layout.addRect(
    feature.id(),
    start,
    start + rootLayout.width * bpPerPx,
    rootLayout.height,
  )

  rootLayout.move(0, topPx)

  return {
    rootLayout,
    name,
    description,
    shouldShowDescription,
    shouldShowName,
    fontHeight,
    labelWidth,
    descriptionWidth,
  }
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

  function chooseGlyphComponent(feature) {
    const strand = feature.get('strand')
    if ([1, -1, '+', '-'].includes(strand)) return Chevron
    return Box
  }

  const featuresRendered = []
  for (const feature of features.values()) {
    const GlyphComponent = chooseGlyphComponent(feature)
    const layoutRecord = (GlyphComponent.layOut || layOut)({
      feature,
      horizontallyFlipped,
      bpPerPx,
      region,
      config,
      layout,
    })
    const {
      rootLayout,
      name,
      description,
      shouldShowDescription,
      shouldShowName,
      fontHeight,
    } = layoutRecord
    const exp = readConfObject(config, 'maxFeatureGlyphExpansion') || 0

    const featureLayout = rootLayout.getSubRecord('feature')
    featuresRendered.push(
      <g
        transform={`translate(${rootLayout.left} ${rootLayout.top})`}
        key={feature.id()}
      >
        <GlyphComponent
          {...props}
          feature={feature}
          featureLayout={featureLayout}
          selected={String(selectedFeatureId) === String(feature.id())}
        />
        {!shouldShowName ? null : (
          <FeatureLabel
            text={name}
            x={rootLayout.getSubRecord('nameLabel').left}
            y={rootLayout.getSubRecord('nameLabel').top}
            color={readConfObject(config, ['labels', 'nameColor'], [feature])}
            fontHeight={fontHeight}
            featureWidth={featureLayout.width}
            allowedWidthExpansion={exp}
          />
        )}
        {!shouldShowDescription ? null : (
          <FeatureLabel
            text={description}
            x={rootLayout.getSubRecord('descriptionLabel').left}
            y={rootLayout.getSubRecord('descriptionLabel').top}
            color={readConfObject(
              config,
              ['labels', 'descriptionColor'],
              [feature],
            )}
            fontHeight={fontHeight}
            featureWidth={featureLayout.width}
            allowedWidthExpansion={exp}
          />
        )}
      </g>,
    )
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
  features: ReactPropTypes.instanceOf(Map),
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
