/* eslint-disable react/require-default-props */
import React, { useRef, useEffect } from 'react'
import { getParent, isStateTreeNode } from 'mobx-state-tree'
import { observer, PropTypes } from 'mobx-react'
import { ImageBitmapType } from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import { LinearSyntenyRenderingProps } from '../LinearSyntenyRenderer'

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
function LinearSyntenyRendering(props: LinearSyntenyRenderingProps) {
  const { trackModel = {}, highResolutionScaling = 1, imageData } = props
  const { width, height } = imageData
  console.log(width, height)
  let voffs = [0, 0]
  if (trackModel && isStateTreeNode(trackModel)) {
    // @ts-ignore
    const { viewOffsets } = trackModel
    const { views } = getParent(trackModel, 2)
    voffs = []
    for (let i = 0; i < views.length; i++) {
      voffs.push(views[i].offsetPx - viewOffsets[i])
    }
  }

  const featureCanvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!imageData) {
      return
    }
    const canvas = featureCanvas.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    context.clearRect(0, 0, width, height)
    context.resetTransform()
    // see https://en.wikipedia.org/wiki/Transformation_matrix#/media/File:2D_affine_transformation_matrix.svg
    context.transform(1, 0, -(voffs[1] - voffs[0]) / height, 1, -voffs[0], 0)
    if (imageData.commands) {
      imageData.commands.forEach(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (command: { style: string; type: string; args: any[] }) => {
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
        },
      )
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
      style={{ width, height }}
    />
  )
}

LinearSyntenyRendering.propTypes = {}

export default observer(LinearSyntenyRendering)
