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
    if (imageData instanceof ImageBitmapType) {
      // console.log('got image data', imageData, imageData.constructor.name)
      context.drawImage(imageData, 0, 0)
    } else if (imageData.dataURL) {
      const img = new Image()
      img.onload = () => context.drawImage(img, 0, 0)
      img.src = imageData.dataURL
    } else {
      // TODO: add support for replay-based image data here
      throw new Error(
        'unsupported imageData type. do you need to add support for it?',
      )
    }
  })

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
  imageData: ReactPropTypes.oneOfType([
    ReactPropTypes.instanceOf(ImageBitmapType),
    ReactPropTypes.shape({ dataURL: ReactPropTypes.string }),
  ]),
  style: ReactPropTypes.objectOf(ReactPropTypes.any),
}
PrerenderedCanvas.defaultProps = {
  imageData: undefined,
  highResolutionScaling: 1,
  style: {},
}

export default PrerenderedCanvas
