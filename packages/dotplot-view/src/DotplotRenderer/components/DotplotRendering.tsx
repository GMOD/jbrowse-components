import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useState, useRef } from 'react'
import { DotplotRenderProps } from '../DotplotRenderer'

function DotplotRendering(props: DotplotRenderProps) {
  const { width, height } = props
  const highlightOverlayCanvas = useRef<HTMLCanvasElement>(null)
  const [down, setDown] = useState<[number, number] | undefined>()
  const [current, setCurrent] = useState<[number, number]>([0, 0])

  useEffect(() => {
    const canvas = highlightOverlayCanvas.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const rect = canvas.getBoundingClientRect()
    if (down) {
      ctx.fillRect(
        down[0] - rect.left,
        down[1] - rect.top,
        current[0] - down[0],
        current[1] - down[1],
      )
    }
  }, [down, current])

  return (
    <div style={{ position: 'relative', zIndex: 1000 }}>
      <PrerenderedCanvas
        style={{ position: 'absolute', left: 0, top: 0 }}
        {...props}
      />
      <canvas
        style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}
        ref={highlightOverlayCanvas}
        onMouseDown={event => {
          setDown([event.clientX, event.clientY])
          setCurrent([event.clientX, event.clientY])
        }}
        onMouseUp={event => {
          setDown(undefined)
        }}
        onMouseLeave={event => {
          setDown(undefined)
        }}
        onMouseMove={event => {
          setCurrent([event.clientX, event.clientY])
        }}
        width={width}
        height={height}
      />
    </div>
  )
}

DotplotRendering.propTypes = {
  // layout: ReactPropTypes.shape({
  //   getRectangles: ReactPropTypes.func.isRequired,
  // }).isRequired,
  height: ReactPropTypes.number.isRequired,
  width: ReactPropTypes.number.isRequired,
  // region: CommonPropTypes.Region.isRequired,
  // bpPerPx: ReactPropTypes.number.isRequired,
  // horizontallyFlipped: ReactPropTypes.bool,
  // blockKey: ReactPropTypes.string,

  // trackModel: ReactPropTypes.shape({
  //   configuration: ReactPropTypes.shape({}),
  //   selectedFeatureId: ReactPropTypes.string,
  //   featureIdUnderMouse: ReactPropTypes.string,
  //   getFeatureOverlapping: ReactPropTypes.func,
  //   features: ReactPropTypes.shape({ get: ReactPropTypes.func }),
  //   blockLayoutFeatures: ReactPropTypes.shape({ get: ReactPropTypes.func }),
  //   setFeatureIdUnderMouse: ReactPropTypes.func,
  // }),

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

DotplotRendering.defaultProps = {
  // blockKey: undefined,
  // horizontallyFlipped: false,
  // trackModel: {
  //   configuration: {},
  //   setFeatureIdUnderMouse: () => {},
  // },
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

export default observer(DotplotRendering)
