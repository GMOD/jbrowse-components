/* eslint-disable @typescript-eslint/no-explicit-any */
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect } from 'react'
import { ImageBitmapType } from '../util/offscreenCanvasPonyfill'

function PrerenderedCanvas(props: {
  width: number
  height: number
  highResolutionScaling: number
  style: any
  imageData: any
}) {
  const { width, height, highResolutionScaling, style, imageData } = props
  const featureCanvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!imageData) return
    const canvas = featureCanvas.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    if (imageData.commands) {
      imageData.commands.forEach((command: any) => {
        if (command.type === 'strokeStyle') {
          context.strokeStyle = command.style
        } else if (command.type === 'fillStyle') {
          context.fillStyle = command.style
        } else if (command.type === 'font') {
          context.font = command.style
        } else {
          // @ts-ignore
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

  return (
    <canvas
      data-testid={`prerendered_canvas`}
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
}
PrerenderedCanvas.defaultProps = {
  imageData: undefined,
  highResolutionScaling: 1,
  style: {},
}

export default PrerenderedCanvas
