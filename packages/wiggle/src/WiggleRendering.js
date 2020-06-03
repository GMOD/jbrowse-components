import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useRef } from 'react'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/util/types/mst'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'

function WiggleRendering(props) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    onMouseLeave,
    onMouseMove,
  } = props
  const [region] = regions
  const ref = useRef()

  function mouseMove(event) {
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = event.clientX - offset
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    let featureUnderMouse
    for (const feature of features.values()) {
      if (clientBp <= feature.get('end') && clientBp >= feature.get('start')) {
        featureUnderMouse = feature
        break
      }
    }

    onMouseMove(event, featureUnderMouse ? featureUnderMouse.id() : undefined)
  }

  function mouseLeave(event) {
    onMouseLeave(event)
  }

  return (
    <div
      ref={ref}
      onMouseMove={mouseMove}
      onMouseLeave={mouseLeave}
      role="presentation"
      className="WiggleRendering"
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
}

WiggleRendering.propTypes = {
  height: ReactPropTypes.number.isRequired,
  width: ReactPropTypes.number.isRequired,
  regions: ReactPropTypes.arrayOf(CommonPropTypes.Region).isRequired,
  features: ReactPropTypes.instanceOf(Map).isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  onMouseLeave: ReactPropTypes.func,
  onMouseMove: ReactPropTypes.func,
}
WiggleRendering.defaultProps = {
  onMouseLeave: () => {},
  onMouseMove: () => {},
}

export default observer(WiggleRendering)
