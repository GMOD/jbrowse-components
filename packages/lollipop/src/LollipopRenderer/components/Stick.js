import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/util/types/mst'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Stick(props) {
  const {
    feature,
    config,
    layoutRecord: {
      anchorLocation,
      y,
      data: { radiusPx },
    },
    selectedFeatureId,
  } = props

  const style = { fill: readConfObject(config, 'bodyColor', [feature]) }
  if (String(selectedFeatureId) === String(feature.id())) {
    style.fill = 'red'
  }
  return (
    <line
      x1={anchorLocation}
      y1={0}
      x2={anchorLocation}
      y2={y + 2 * radiusPx}
      stroke={readConfObject(config, 'stickColor', [feature])}
      strokeWidth={readConfObject(config, 'stickWidth', ['feature'])}
    />
  )
}
Stick.propTypes = {
  feature: ReactPropTypes.shape({
    id: ReactPropTypes.func.isRequired,
    get: ReactPropTypes.func.isRequired,
  }).isRequired,
  // bpPerPx: ReactPropTypes.number.isRequired,
  // region: CommonPropTypes.Region.isRequired,
  // config: CommonPropTypes.ConfigSchema.isRequired,
  layoutRecord: ReactPropTypes.shape({
    x: ReactPropTypes.number.isRequired,
    y: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    height: ReactPropTypes.number.isRequired,
    anchorLocation: ReactPropTypes.number.isRequired,
    data: ReactPropTypes.shape({ radiusPx: ReactPropTypes.number.isRequired })
      .isRequired,
  }).isRequired,

  selectedFeatureId: ReactPropTypes.string,

  config: CommonPropTypes.ConfigSchema.isRequired,

  onFeatureMouseDown: ReactPropTypes.func,
  onFeatureMouseEnter: ReactPropTypes.func,
  onFeatureMouseOut: ReactPropTypes.func,
  onFeatureMouseOver: ReactPropTypes.func,
  onFeatureMouseUp: ReactPropTypes.func,
  onFeatureMouseLeave: ReactPropTypes.func,
  onFeatureMouseMove: ReactPropTypes.func,

  // synthesized from mouseup and mousedown
  onFeatureClick: ReactPropTypes.func,
}

Stick.defaultProps = {
  selectedFeatureId: undefined,

  onFeatureMouseDown: undefined,
  onFeatureMouseEnter: undefined,
  onFeatureMouseOut: undefined,
  onFeatureMouseOver: undefined,
  onFeatureMouseUp: undefined,
  onFeatureMouseLeave: undefined,
  onFeatureMouseMove: undefined,

  onFeatureClick: undefined,
}
export default observer(Stick)
