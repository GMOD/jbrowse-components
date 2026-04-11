import { useMemo, useRef } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  getContainingView,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { createDotplotRenderer } from '../DotplotRenderer.ts'

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

  const gpuOpts = useMemo(
    () => ({
      onReady: model.setGpuRenderer,
      onDispose: () => {
        model.setGpuRenderer(null)
      },
    }),
    [model],
  )

  const { error: gpuError } = useGpuRenderer(
    canvasRef,
    createDotplotRenderer,
    gpuOpts,
  )

  // SYNC across model-driven GPU displays (dotplot, linear synteny,
  // multi-LGV synteny): bumps tabVisibilityVersion so the model draw autorun
  // re-fires on tab restore. Hook-driven displays pass renderNow directly to
  // useTabVisibilityRerender instead.
  useTabVisibilityRerender(() => {
    model.bumpTabVisibility()
  })

  if (model.error) {
    return <ErrorMessage error={model.error} />
  }

  return (
    <div style={{ position: 'relative', width: viewWidth, height: viewHeight }}>
      <canvas
        ref={canvasRef}
        data-testid={
          model.canvasDrawn
            ? 'dotplot_webgl_canvas_done'
            : 'dotplot_webgl_canvas'
        }
        style={{
          width: viewWidth,
          height: viewHeight,
          imageRendering: 'auto',
        }}
      />
      {gpuError ? <ErrorMessage error={gpuError} /> : null}
      {model.isLoading ? (
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
      {model.isRefetching ? (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            opacity: 0.7,
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
