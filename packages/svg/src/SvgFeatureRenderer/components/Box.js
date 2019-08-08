import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Box(props) {
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

  const style = { fill: readConfObject(config, 'color1', [feature]) }
  if (selected) style.fill = 'red'

  return (
    <rect
      title={feature.id()}
      data-testid={feature.id()}
      x={featureLayout.left}
      y={featureLayout.top}
      width={Math.max(featureLayout.width, 1)}
      height={featureLayout.height}
      style={style}
      onMouseDown={onFeatureMouseDown}
      onMouseEnter={onFeatureMouseEnter}
      onMouseOut={onFeatureMouseOut}
      onMouseOver={onFeatureMouseOver}
      onMouseUp={onFeatureMouseUp}
      onMouseLeave={onFeatureMouseLeave}
      onMouseMove={onFeatureMouseMove}
      onClick={onFeatureClick}
      onFocus={onFeatureMouseOver}
      onBlur={onFeatureMouseOut}
    />
  )
}

Box.propTypes = {
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

Box.defaultProps = {
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

export default observer(Box)
