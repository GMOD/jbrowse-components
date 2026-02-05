import { useEffect, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLArcsRenderer } from './WebGLArcsRenderer.ts'

import type { LinearWebGLArcsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const WebGLArcsComponent = observer(function WebGLArcsComponent({
  model,
}: {
  model: LinearWebGLArcsDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLArcsRenderer | null>(null)
  const rafRef = useRef<number>()
  const [error, setError] = useState<string | null>(null)

  const view = getContainingView(model) as LGV

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    try {
      rendererRef.current = new WebGLArcsRenderer(canvas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL initialization failed')
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  // Upload data when rpcData changes
  useEffect(() => {
    const renderer = rendererRef.current
    const data = model.rpcData
    if (!renderer || !data) {
      return
    }

    renderer.uploadFromTypedArrays({
      regionStart: data.regionStart,
      arcPositions: data.arcPositions,
      arcYs: data.arcYs,
      arcColorTypes: data.arcColorTypes,
      arcOffsets: data.arcOffsets,
      arcLengths: data.arcLengths,
      numArcs: data.numArcs,
      linePositions: data.linePositions,
      lineYs: data.lineYs,
      lineColorTypes: data.lineColorTypes,
      numLines: data.numLines,
    })
  }, [model.rpcData])

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized) {
      return
    }

    function renderFrame() {
      if (!renderer) {
        return
      }

      const visibleRegion = model.visibleRegion
      if (!visibleRegion) {
        rafRef.current = requestAnimationFrame(renderFrame)
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const width = Math.round(view.dynamicBlocks.totalWidthPx)
      const height = model.height

      renderer.render({
        domainX: [visibleRegion.start, visibleRegion.end],
        lineWidth: model.lineWidth,
        canvasWidth: width,
        canvasHeight: height,
      })

      rafRef.current = requestAnimationFrame(renderFrame)
    }

    renderFrame()

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [model, view.initialized, view.dynamicBlocks.totalWidthPx, model.height])

  if (error) {
    return <div style={{ color: 'red', padding: 10 }}>WebGL Error: {error}</div>
  }

  if (model.isLoading) {
    return <div style={{ padding: 10 }}>Loading...</div>
  }

  if (model.error) {
    return (
      <div style={{ color: 'red', padding: 10 }}>
        Error: {model.error.message}
      </div>
    )
  }

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
        width={width}
        height={height}
      />
    </div>
  )
})

export default WebGLArcsComponent
