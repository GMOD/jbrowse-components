import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { DotplotWebGLRenderer } from '../drawDotplotWebGL.ts'

import type { DotplotViewModel } from '../../DotplotView/model.ts'
import type { DotplotDisplayModel } from '../stateModelFactory.tsx'

const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1

const DotplotWebGLCanvas = observer(function DotplotWebGLCanvas(props: {
  model: DotplotDisplayModel
  children?: React.ReactNode
}) {
  const { model, children } = props
  const view = getContainingView(model) as DotplotViewModel
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Canvas shows the plot area only (excludes axes/borders)
  const canvasWidth = view.viewWidth
  const canvasHeight = view.viewHeight
  const borderX = view.borderX
  const borderY = view.borderY

  console.log('DotplotWebGLCanvas: render called with dimensions', {
    canvasWidth,
    canvasHeight,
    borderX,
    borderY,
    dpr,
  })

  if (canvasWidth <= 0 || canvasHeight <= 0) {
    console.warn('DotplotWebGLCanvas: invalid dimensions', { canvasWidth, canvasHeight })
    return null
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.warn('DotplotWebGLCanvas: canvas ref is null')
      return
    }

    console.log('DotplotWebGLCanvas: initializing renderer with canvas', {
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
    })
    const renderer = new DotplotWebGLRenderer()
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    console.log('DotplotWebGLCanvas: canvas properties after setting size', {
      canvas_width: canvas.width,
      canvas_height: canvas.height,
      style_width: canvas.style.width,
      style_height: canvas.style.height,
    })

    if (!renderer.init(canvas)) {
      console.error('WebGL initialization failed!')
      model.setWebGLRenderer(null)
      return
    }

    console.log('DotplotWebGLCanvas: renderer initialized successfully')
    model.setWebGLRenderer(renderer)
    model.setWebGLInitialized(true)

    return () => {
      console.log('DotplotWebGLCanvas: cleaning up')
      renderer.dispose()
      model.setWebGLRenderer(null)
      model.setWebGLInitialized(false)
    }
  }, [model, canvasWidth, canvasHeight])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    console.log('handleMouseMove: x=', x, 'y=', y, 'renderer=', !!model.webglRenderer)
    const featureIdx = model.webglRenderer?.pick(x, y)
    if (featureIdx !== undefined && featureIdx >= 0) {
      const feat = model.featPositions[featureIdx]
      if (feat) {
        console.log('handleMouseMove: found feature at index', featureIdx)
        model.setMouseoverId(feat.f.id?.())
      }
    } else {
      model.setMouseoverId(undefined)
    }
  }

  const handleMouseLeave = () => {
    console.log('handleMouseLeave')
    model.setMouseoverId(undefined)
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    console.log('handleClick: x=', x, 'y=', y)
    const featureIdx = model.webglRenderer?.pick(x, y)
    if (featureIdx !== undefined && featureIdx >= 0) {
      const feat = model.featPositions[featureIdx]
      if (feat) {
        console.log('handleClick: found feature at index', featureIdx)
        view.onFeatureClick?.(feat.f, e as any)
      }
    }
  }

  // Canvas positioned within the bordered area
  console.log('DotplotWebGLCanvas: canvas positioned at offset', { borderX, borderY })

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth * dpr}
      height={canvasHeight * dpr}
      style={{
        position: 'absolute',
        left: borderX,
        top: borderY,
        width: canvasWidth,
        height: canvasHeight,
        display: 'block',
        zIndex: 1,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  )
})

export default DotplotWebGLCanvas
