import React, { useRef, useState, useEffect } from 'react'
import { drawImageOntoCanvasContext } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { observer } from 'mobx-react'

/**
 * A block whose content is rendered outside of the main thread and hydrated by
 * this component.
 */
interface ModelType {
  imageData: string
  style: Record<string, string>
  renderProps: {
    width: number
    height: number
    highResolutionScaling?: number
  }
}
const ServerSideSyntenyRendering = observer(function ({
  model,
}: {
  model: ModelType
}) {
  const { imageData, style, renderProps } = model
  const { width, height, highResolutionScaling = 1 } = renderProps

  const featureCanvas = useRef<HTMLCanvasElement>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!imageData) {
      return
    }
    const canvas = featureCanvas.current!
    const context = canvas.getContext('2d')!
    drawImageOntoCanvasContext(imageData, context)
    setDone(true)
  }, [imageData])

  return (
    <canvas
      data-testid={`prerendered_canvas${done ? '_done' : ''}`}
      ref={featureCanvas}
      width={width * highResolutionScaling}
      height={height * highResolutionScaling}
      style={{ width, height, ...style }}
    />
  )
})

export default ServerSideSyntenyRendering
