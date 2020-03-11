import React, { useRef, useEffect } from 'react'
import { observer, PropTypes } from 'mobx-react'
import { ImageBitmapType } from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
function ServerSideSyntenyRendering(props) {
  const { model } = props
  const {
    imageData,
    effectiveWidth: width,
    effectiveHeight: height,
    style,
    highResolutionScaling,
  } = model

  const featureCanvas = useRef()

  useEffect(() => {
    if (!imageData) {
      return
    }
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

ServerSideSyntenyRendering.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default observer(ServerSideSyntenyRendering)
