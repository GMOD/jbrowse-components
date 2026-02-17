import { useCallback, useRef } from 'react'

import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { DotplotWebGPUProxy } from '../DotplotWebGPUProxy.ts'

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
      const { rpcManager } = getSession(model)
      const proxy = DotplotWebGPUProxy.getOrCreate(canvas, rpcManager)
      proxy.init(canvas).then(success => {
        model.setGpuRenderer(proxy)
        model.setGpuInitialized(success)
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
