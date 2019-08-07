import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import Box from './Box'
import Chevron from './Chevron'
import './SvgFeatureRendering.scss'

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

  function chooseGlyphComponent(/* feature */) {
    return Box
  }

  const featuresRendered = []
  for (const feature of features.values()) {
    const FeatureComponent = chooseGlyphComponent(feature)
    const layoutRecord = FeatureComponent.layout({
      feature,
      horizontallyFlipped,
      bpPerPx,
      region,
      config,
      layout,
    })
    featuresRendered.push(
      <FeatureComponent
        {...props}
        layoutRecord={layoutRecord}
        feature={feature}
        key={feature.id()}
        selectedFeatureId={selectedFeatureId}
      />,
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
