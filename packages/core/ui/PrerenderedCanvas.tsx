import React, { useState, useRef, useEffect } from 'react'
import { drawImageOntoCanvasContext } from '../util/offscreenCanvasPonyfill'

function PrerenderedCanvas(props: {
  width: number
  height: number
  highResolutionScaling?: number
  style?: any
  imageData?: any
  showSoftClip?: boolean
  blockKey?: string
}) {
  const {
    width,
    height,
    highResolutionScaling = 1,
    style = {},
    imageData,
    blockKey,
    showSoftClip,
  } = props
  const [done, setDone] = useState(false)

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
    drawImageOntoCanvasContext(imageData, context)
    setDone(true)
  }, [imageData])

  return (
    <canvas
      data-testid={[
        'prerendered_canvas',
        showSoftClip ? 'softclipped' : '',
        blockKey,
        done ? 'done' : '',
      ]
        .filter(f => !!f)
        .join('_')}
      ref={featureCanvas}
      width={width * highResolutionScaling}
      height={height * highResolutionScaling}
      style={{ width, height, ...style }}
    />
  )
}

export default PrerenderedCanvas
