import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useState, useRef } from 'react'
import './WiggleRendering.scss'

const toP = s => parseFloat(s.toPrecision(6))

function Tooltip({ offsetX, feature }) {
  return (
    <>
      <div
        className="hoverLabel"
        style={{ left: `${offsetX}px`, zIndex: 10000 }}
      >
        {feature.get('maxScore') !== undefined ? (
          <div>
            Summary
            <br />
            Max: {toP(feature.get('maxScore'))}
            <br />
            Avg: {toP(feature.get('score'))}
            <br />
            Min: {toP(feature.get('minScore'))}
          </div>
        ) : (
          toP(feature.get('score'))
        )}
      </div>
      <div className="hoverVertical" style={{ left: `${offsetX}px` }} />
    </>
  )
}

Tooltip.propTypes = {
  offsetX: ReactPropTypes.number.isRequired,
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func }).isRequired,
}

function WiggleRendering(props) {
  const {
    region,
    features,
    bpPerPx,
    horizontallyFlipped,
    width,
    height,
  } = props
  const ref = useRef()
  const [featureUnderMouse, setFeatureUnderMouse] = useState()
  const [clientX, setClientX] = useState()

  let offset = 0
  if (ref.current) {
    offset = ref.current.getBoundingClientRect().left
  }
  function onMouseMove(evt) {
    const offsetX = evt.clientX - offset
    const px = horizontallyFlipped ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    for (const feature of features.values()) {
      if (clientBp <= feature.get('end') && clientBp >= feature.get('start')) {
        setFeatureUnderMouse(feature)
        break
      }
    }
    setClientX(evt.clientX)
  }

  function onMouseLeave() {
    setFeatureUnderMouse(undefined)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      role="presentation"
      onFocus={() => {}}
      className="WiggleRendering"
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
      {featureUnderMouse ? (
        <Tooltip feature={featureUnderMouse} offsetX={clientX - offset} />
      ) : null}
    </div>
  )
}

WiggleRendering.propTypes = {
  height: ReactPropTypes.number.isRequired,
  width: ReactPropTypes.number.isRequired,
  region: CommonPropTypes.Region.isRequired,
  features: ReactPropTypes.instanceOf(Map).isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
  horizontallyFlipped: ReactPropTypes.bool,
  trackModel: ReactPropTypes.shape({
    /** id of the currently selected feature, if any */
    selectedFeatureId: ReactPropTypes.string,
  }),
}

WiggleRendering.defaultProps = {
  horizontallyFlipped: false,
  trackModel: {},
}
export default observer(WiggleRendering)
