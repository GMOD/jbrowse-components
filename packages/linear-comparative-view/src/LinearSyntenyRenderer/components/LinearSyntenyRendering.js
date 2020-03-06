import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function LinearSyntenyRendering(props) {
  const { width, height } = props
  console.log('i have been called')

  const canvasWidth = Math.ceil(width)
  // need to call this in render so we get the right observer behavior
  return (
    <div
      className="LinearSyntenyRendering"
      style={{ position: 'relative', width: canvasWidth, height }}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </div>
  )
}

LinearSyntenyRendering.propTypes = {
  layout: ReactPropTypes.shape({
    getRectangles: ReactPropTypes.func.isRequired,
  }).isRequired,
  height: ReactPropTypes.number.isRequired,
  width: ReactPropTypes.number.isRequired,
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  horizontallyFlipped: ReactPropTypes.bool,
  blockKey: ReactPropTypes.string,

  trackModel: ReactPropTypes.shape({
    configuration: ReactPropTypes.shape({}),
    selectedFeatureId: ReactPropTypes.string,
    featureIdUnderMouse: ReactPropTypes.string,
    getFeatureOverlapping: ReactPropTypes.func,
    features: ReactPropTypes.shape({ get: ReactPropTypes.func }),
    blockLayoutFeatures: ReactPropTypes.shape({ get: ReactPropTypes.func }),
    setFeatureIdUnderMouse: ReactPropTypes.func,
  }),

  onFeatureMouseDown: ReactPropTypes.func,
  onFeatureMouseEnter: ReactPropTypes.func,
  onFeatureMouseOut: ReactPropTypes.func,
  onFeatureMouseOver: ReactPropTypes.func,
  onFeatureMouseUp: ReactPropTypes.func,
  onFeatureMouseLeave: ReactPropTypes.func,
  onFeatureMouseMove: ReactPropTypes.func,

  // synthesized from mouseup and mousedown
  onFeatureClick: ReactPropTypes.func,

  onMouseDown: ReactPropTypes.func,
  onMouseUp: ReactPropTypes.func,
  onMouseEnter: ReactPropTypes.func,
  onMouseLeave: ReactPropTypes.func,
  onMouseOver: ReactPropTypes.func,
  onMouseOut: ReactPropTypes.func,
  onClick: ReactPropTypes.func,
}

LinearSyntenyRendering.defaultProps = {
  blockKey: undefined,
  horizontallyFlipped: false,
  trackModel: {
    configuration: {},
    setFeatureIdUnderMouse: () => {},
  },
  onFeatureMouseDown: undefined,
  onFeatureMouseEnter: undefined,
  onFeatureMouseOut: undefined,
  onFeatureMouseOver: undefined,
  onFeatureMouseUp: undefined,
  onFeatureMouseLeave: undefined,
  onFeatureMouseMove: undefined,
  onFeatureClick: undefined,
  onMouseDown: undefined,
  onMouseUp: undefined,
  onMouseEnter: undefined,
  onMouseLeave: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onClick: undefined,
}

export default observer(LinearSyntenyRendering)
