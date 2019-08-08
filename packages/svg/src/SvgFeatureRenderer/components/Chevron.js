import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Chevron(props) {
  function onFeatureMouseDown(event) {
    const { onFeatureMouseDown: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseEnter(event) {
    const { onFeatureMouseEnter: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseOut(event) {
    const { onFeatureMouseOut: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseOver(event) {
    const { onFeatureMouseOver: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseUp(event) {
    const { onFeatureMouseUp: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseLeave(event) {
    const { onFeatureMouseLeave: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseMove(event) {
    const { onFeatureMouseMove: handler, feature } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureClick(event) {
    const { onFeatureClick: handler, feature } = props
    if (!handler) return undefined
    event.stopPropagation()
    return handler(event, feature.id())
  }

  const { feature, config, featureLayout, selected } = props

  const width = Math.max(featureLayout.width, 1)
  const { top, left, height } = featureLayout

  const shapeProps = {
    title: feature.id(),
    'data-testid': feature.id(),
    onMouseDown: onFeatureMouseDown,
    onMouseEnter: onFeatureMouseEnter,
    onMouseOut: onFeatureMouseOut,
    onMouseOver: onFeatureMouseOver,
    onMouseUp: onFeatureMouseUp,
    onMouseLeave: onFeatureMouseLeave,
    onMouseMove: onFeatureMouseMove,
    onClick: onFeatureClick,
    onFocus: onFeatureMouseOver,
    onBlur: onFeatureMouseOut,
    transform: [-1, '-'].includes(feature.get('strand'))
      ? `rotate(180,${left + width / 2},${top + height / 2})`
      : undefined,
  }
  const color1 = readConfObject(config, 'color1', [feature])
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }

  return width > height / 2 ? (
    <polygon
      {...shapeProps}
      stroke={selected ? 'black' : undefined}
      fill={selected ? emphasizedColor1 : color1}
      points={[
        [left, top],
        [left + width - height / 2, top],
        [left + width, top + height / 2],
        [left + width - height / 2, top + height],
        [left, top + height],
        [left + height / 2, top + height / 2],
      ]}
    />
  ) : (
    <polyline
      {...shapeProps}
      points={[
        [left, top],
        [left + width, top + height / 2],
        [left, top + height],
      ]}
      stroke={selected ? emphasizedColor1 : color1}
      fill="none"
    />
  )
}

Chevron.propTypes = {
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func.isRequired })
    .isRequired,
  // horizontallyFlipped: ReactPropTypes.bool,
  // bpPerPx: ReactPropTypes.number.isRequired,
  // region: CommonPropTypes.Region.isRequired,
  // config: CommonPropTypes.ConfigSchema.isRequired,
  featureLayout: ReactPropTypes.shape({
    top: ReactPropTypes.number.isRequired,
    left: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    height: ReactPropTypes.number.isRequired,
  }).isRequired,

  selected: ReactPropTypes.bool,

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

Chevron.defaultProps = {
  // horizontallyFlipped: false,

  selected: false,

  onFeatureMouseDown: undefined,
  onFeatureMouseEnter: undefined,
  onFeatureMouseOut: undefined,
  onFeatureMouseOver: undefined,
  onFeatureMouseUp: undefined,
  onFeatureMouseLeave: undefined,
  onFeatureMouseMove: undefined,

  onFeatureClick: undefined,
}

export default observer(Chevron)
