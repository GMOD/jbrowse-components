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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const renderer = new DotplotWebGLRenderer()
    canvas.width = view.width * dpr
    canvas.height = view.height * dpr
    if (!renderer.init(canvas)) {
      console.warn('WebGL initialization failed, falling back to Canvas2D')
      model.setWebGLRenderer(null)
      return
    }

    model.setWebGLRenderer(renderer)
    model.setWebGLInitialized(true)

    return () => {
      renderer.dispose()
      model.setWebGLRenderer(null)
      model.setWebGLInitialized(false)
    }
  }, [model])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const featureIdx = model.webglRenderer?.pick(x, y)
    if (featureIdx !== undefined && featureIdx >= 0) {
      const feat = model.featPositions[featureIdx]
      if (feat) {
        model.setMouseoverId(feat.f.id?.())
      }
    } else {
      model.setMouseoverId(undefined)
    }
  }

  const handleMouseLeave = () => {
    model.setMouseoverId(undefined)
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const featureIdx = model.webglRenderer?.pick(x, y)
    if (featureIdx !== undefined && featureIdx >= 0) {
      const feat = model.featPositions[featureIdx]
      if (feat) {
        view.onFeatureClick?.(feat.f, e as any)
      }
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={view.width * dpr}
        height={view.height * dpr}
        style={{
          width: view.width,
          height: view.height,
          display: 'block',
          position: 'absolute',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {children}
    </div>
  )
})

export default DotplotWebGLCanvas
