import React, { useRef, useEffect } from 'react'
import { observer, PropTypes } from 'mobx-react'
import { drawImageOntoCanvasContext } from '@jbrowse/core/util/offscreenCanvasPonyfill'

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
function ServerSideSyntenyRendering(props) {
  const { model } = props
  const { imageData, style, renderProps } = model
  const { width, height, highResolutionScaling = 1 } = renderProps

  const featureCanvas = useRef()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!imageData) {
      return
    }
    const canvas = featureCanvas.current
    const context = canvas.getContext('2d')
    drawImageOntoCanvasContext(imageData, context)
    setDone(true)
  }, [height, imageData, width])

  return (
    <canvas
      data-testid={`prerendered_canvas${done ? '_done' : ''}`}
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
