import React, { useRef, useEffect } from 'react'
import { getParent } from 'mobx-state-tree'
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
    viewOffsets,
  } = model
  const { views } = getParent(model, 2)
  const voffs = []
  for (let i = 0; i < views.length; i++) {
    voffs.push(views[i].offsetPx - viewOffsets[i])
  }

  const featureCanvas = useRef()

  useEffect(() => {
    if (!imageData) {
      return
    }
    const canvas = featureCanvas.current
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, width, height)
    context.resetTransform()
    // see https://en.wikipedia.org/wiki/Transformation_matrix#/media/File:2D_affine_transformation_matrix.svg
    context.transform(1, 0, -(voffs[1] - voffs[0]) / height, 1, -voffs[0], 0)
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
  }, [height, imageData, voffs, width])

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
