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
      console.log('[WebGLArcs] init effect: no canvas')
      return
    }

    try {
      console.log('[WebGLArcs] creating renderer')
      rendererRef.current = new WebGLArcsRenderer(canvas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL initialization failed')
    }

    return () => {
      console.log('[WebGLArcs] destroying renderer')
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
      console.log('[WebGLArcs] upload skipped: renderer=', !!renderer, 'data=', !!data)
      return
    }

    console.log('[WebGLArcs] uploading data: numArcs=', data.numArcs, 'numLines=', data.numLines, 'regionStart=', data.regionStart)
    renderer.uploadFromTypedArrays({
      regionStart: data.regionStart,
      arcX1: data.arcX1,
      arcX2: data.arcX2,
      arcColorTypes: data.arcColorTypes,
      arcIsArc: data.arcIsArc,
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
      console.log('[WebGLArcs] render loop skipped: renderer=', !!renderer, 'initialized=', view.initialized)
      return
    }

    let frameCount = 0
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

      if (frameCount === 0) {
        console.log('[WebGLArcs] first render frame: domain=', visibleRegion.start, '-', visibleRegion.end, 'size=', width, 'x', height)
      }
      frameCount++

      renderer.render({
        domainX: [visibleRegion.start, visibleRegion.end],
        lineWidth: model.lineWidth,
        canvasWidth: width,
        canvasHeight: height,
        dpr: window.devicePixelRatio || 1,
      })

      rafRef.current = requestAnimationFrame(renderFrame)
    }

    console.log('[WebGLArcs] starting render loop')
    renderFrame()

    return () => {
      console.log('[WebGLArcs] stopping render loop after', frameCount, 'frames')
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [model, view.initialized, view.dynamicBlocks.totalWidthPx, model.height])

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
      />
      {error ? (
        <div style={{ color: 'red', padding: 10, position: 'absolute' }}>
          WebGL Error: {error}
        </div>
      ) : model.error ? (
        <div style={{ color: 'red', padding: 10, position: 'absolute' }}>
          Error: {model.error.message}
        </div>
      ) : model.isLoading ? (
        <div style={{ padding: 10, position: 'absolute' }}>Loading...</div>
      ) : null}
    </div>
  )
})

export default WebGLArcsComponent
