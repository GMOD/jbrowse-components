import { useEffect, useRef } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  getContainingView,
  setupWebGLContextLossHandler,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { DotplotWebGLRenderer } from '../drawDotplotWebGL.ts'

import type { DotplotViewModel } from '../../DotplotView/model.ts'
import type { DotplotDisplayModel } from '../stateModelFactory.tsx'

const DotplotDisplay = observer(function DotplotDisplay(props: {
  model: DotplotDisplayModel
  children?: React.ReactNode
}) {
  const { model, children } = props
  const view = getContainingView(model) as DotplotViewModel
  const { viewWidth, viewHeight } = view
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      return setupWebGLContextLossHandler(canvas, () => {
        model.webglRenderer?.dispose()
        const newRenderer = new DotplotWebGLRenderer()
        const success = newRenderer.init(canvas)
        model.setWebGLRenderer(newRenderer)
        model.setWebGLInitialized(success)
      })
    }
    return undefined
  }, [model])

  // Initialize/dispose WebGL renderer — only on mount/unmount.
  // Dimension changes are handled by renderer.resize() in the draw autorun.
  useEffect(() => {
    if (canvasRef.current) {
      const renderer = new DotplotWebGLRenderer()
      const success = renderer.init(canvasRef.current)
      model.setWebGLRenderer(renderer)
      model.setWebGLInitialized(success)
      return () => {
        model.webglRenderer?.dispose()
        model.setWebGLRenderer(null)
        model.setWebGLInitialized(false)
      }
    }
    return undefined
  }, [model])

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1

  if (model.error) {
    return <ErrorMessage error={model.error} />
  }

  return (
    <div style={{ position: 'relative', width: viewWidth, height: viewHeight }}>
      <canvas
        ref={canvasRef}
        data-testid="dotplot_webgl_canvas"
        width={viewWidth * dpr}
        height={viewHeight * dpr}
        style={{
          width: viewWidth,
          height: viewHeight,
          imageRendering: 'auto',
        }}
      />
      {!model.features ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: viewWidth,
            height: viewHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LoadingEllipses />
        </div>
      ) : null}
      {children}
    </div>
  )
})

export default DotplotDisplay
