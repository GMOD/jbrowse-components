import { useCallback, useRef } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { DotplotRenderer } from '../DotplotRenderer.ts'

import type { DotplotViewModel } from '../../DotplotView/model.ts'
import type { DotplotDisplayModel } from '../stateModelFactory.tsx'

const DotplotDisplay = observer(function DotplotDisplay(props: {
  model: DotplotDisplayModel
  children?: React.ReactNode
}) {
  const { model, children } = props
  const view = getContainingView(model) as DotplotViewModel
  const { viewWidth, viewHeight } = view
  const gpuCanvasRef = useRef<HTMLCanvasElement>(null)

  const gpuCanvasCallbackRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      gpuCanvasRef.current = canvas
      if (!canvas) {
        return
      }
      const renderer = DotplotRenderer.getOrCreate(canvas)
      renderer.init().then(success => {
        if (!success) {
          console.error('[DotplotDisplay] GPU initialization failed')
        }
        model.setGpuRenderer(renderer)
        model.setGpuInitialized(success)
      }).catch((e: unknown) => {
        console.error('[DotplotDisplay] GPU initialization error:', e)
        model.setGpuInitialized(false)
      })
    },
    [model],
  )

  if (model.error) {
    return <ErrorMessage error={model.error} />
  }

  return (
    <div style={{ position: 'relative', width: viewWidth, height: viewHeight }}>
      <canvas
        ref={gpuCanvasCallbackRef}
        data-testid="dotplot_webgl_canvas"
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
