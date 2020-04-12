import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect } from 'react'
import { ImageBitmapType } from '../util/offscreenCanvasPonyfill'

function PrerenderedCanvas(props) {
  const { width, height, highResolutionScaling, style, imageData } = props
  const featureCanvas = useRef()

  useEffect(() => {
    if (!imageData) return
    const canvas = featureCanvas.current
    const context = canvas.getContext('2d')
    if (imageData.commands) {
      imageData.commands.forEach(command => {
        if (command.type === 'strokeStyle') {
          context.strokeStyle = command.style
        } else if (command.type === 'fillStyle') {
          context.fillStyle = command.style
        } else if (command.type === 'font') {
          context.font = command.style
        } else {
          context[command.type](...command.args)
        }
      })
    } else if (imageData instanceof ImageBitmapType) {
      context.drawImage(imageData, 0, 0)
    } else if (imageData.dataURL) {
      const img = new Image()
      img.onload = () => context.drawImage(img, 0, 0)
      img.src = imageData.dataURL
    }
  }, [imageData])

  // appends renderertype for testing multiple subtracks (multiple canvases) loading
  return (
    <canvas
      data-testid="prerendered_canvas"
      ref={featureCanvas}
      width={width * highResolutionScaling}
      height={height * highResolutionScaling}
      style={{ width, height, ...style }}
    />
  )
}

PrerenderedCanvas.propTypes = {
  height: ReactPropTypes.number.isRequired,
  width: ReactPropTypes.number.isRequired,
  highResolutionScaling: ReactPropTypes.number,
  style: ReactPropTypes.objectOf(ReactPropTypes.any),
  imageData: ReactPropTypes.any,
  // config: ReactPropTypes.objectOf(ReactPropTypes.any),
}
PrerenderedCanvas.defaultProps = {
  imageData: undefined,
  highResolutionScaling: 1,
  style: {},
  // config: {},
}

export default PrerenderedCanvas
