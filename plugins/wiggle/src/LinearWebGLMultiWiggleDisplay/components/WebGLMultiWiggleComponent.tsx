import { useCallback, useEffect, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { parseColor } from '../../shared/webglUtils.ts'
import { useWebGLViewInteraction } from '../../LinearWebGLWiggleDisplay/components/useWebGLViewInteraction.ts'
import { WebGLMultiWiggleRenderer } from './WebGLMultiWiggleRenderer.ts'

import type {
  MultiRenderingType,
  SourceRenderData,
} from './WebGLMultiWiggleRenderer.ts'
import type { LinearWebGLMultiWiggleDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const ROW_PADDING = 2

const WebGLMultiWiggleComponent = observer(
  function WebGLMultiWiggleComponent({
    model,
  }: {
    model: LinearWebGLMultiWiggleDisplayModel
  }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<WebGLMultiWiggleRenderer | null>(null)
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
        rendererRef.current = new WebGLMultiWiggleRenderer(canvas)
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

      const sourcesData: SourceRenderData[] = data.sources.map(source => ({
        featurePositions: source.featurePositions,
        featureScores: source.featureScores,
        numFeatures: source.numFeatures,
        color: parseColor(source.color),
      }))

      renderer.uploadFromSources(data.regionStart, sourcesData)
    }, [model.rpcData])

    // Render with explicit domain (for immediate rendering during interaction)
    const renderWithDomain = useCallback(
      (domainX: [number, number]) => {
        const renderer = rendererRef.current
        if (!renderer) {
          return
        }
        const domain = model.domain
        if (!domain) {
          return
        }
        const width = Math.round(view.dynamicBlocks.totalWidthPx)
        const height = model.height

        renderer.render({
          domainX,
          domainY: domain,
          scaleType: model.scaleType as 'linear' | 'log',
          canvasWidth: width,
          canvasHeight: height,
          rowPadding: ROW_PADDING,
          renderingType: model.renderingType as MultiRenderingType,
        })
      },
      [model, view],
    )

    // Use the shared interaction hook for pan/zoom
    const {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      isDragging,
    } = useWebGLViewInteraction({
      canvasRef,
      view,
      onRender: renderWithDomain,
    })

    // Render when state changes (on-demand rendering instead of continuous loop)
    useEffect(() => {
      const renderer = rendererRef.current
      if (!renderer || !view.initialized) {
        return
      }

      const visibleRegion = model.visibleRegion
      if (!visibleRegion) {
        return
      }

      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const domain = model.domain
      if (!domain) {
        return
      }

      const width = Math.round(view.dynamicBlocks.totalWidthPx)
      const height = model.height

      // Use RAF for smooth rendering but only render once per state change
      rafRef.current = requestAnimationFrame(() => {
        renderer.render({
          domainX: [visibleRegion.start, visibleRegion.end],
          domainY: domain,
          scaleType: model.scaleType as 'linear' | 'log',
          canvasWidth: width,
          canvasHeight: height,
          rowPadding: ROW_PADDING,
          renderingType: model.renderingType as MultiRenderingType,
        })
      })

      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }
      }
    }, [
      model,
      model.rpcData,
      model.height,
      model.scaleType,
      model.renderingType,
      model.visibleRegion,
      model.domain,
      view.initialized,
      view.dynamicBlocks.totalWidthPx,
    ])

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.height

    if (error) {
      return (
        <div style={{ width, height, color: 'red', padding: 10 }}>
          WebGL Error: {error}
        </div>
      )
    }

    if (model.error) {
      return (
        <div style={{ width, height, color: 'red', padding: 10 }}>
          Error: {model.error.message}
        </div>
      )
    }

    // Render source labels on the left
    const numSources = model.numSources
    const rowHeight =
      numSources > 0
        ? (height - ROW_PADDING * (numSources - 1)) / numSources
        : height

    return (
      <div style={{ position: 'relative', width, height, display: 'flex' }}>
        {/* Source labels sidebar */}
        {model.rpcData && model.rpcData.sources.length > 1 ? (
          <div
            style={{
              width: 100,
              height,
              overflow: 'hidden',
              flexShrink: 0,
              fontSize: 10,
            }}
          >
            {model.rpcData.sources.map((source, idx) => (
              <div
                key={source.name}
                style={{
                  height: rowHeight,
                  marginBottom: idx < numSources - 1 ? ROW_PADDING : 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderLeft: `3px solid ${source.color}`,
                }}
                title={source.name}
              >
                {source.name}
              </div>
            ))}
          </div>
        ) : null}

        {/* Canvas */}
        <div style={{ position: 'relative', flex: 1, height }}>
          <canvas
            ref={canvasRef}
            style={{
              width: model.rpcData && model.rpcData.sources.length > 1
                ? width - 100
                : width,
              height,
              position: 'absolute',
              left: 0,
              top: 0,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            width={
              model.rpcData && model.rpcData.sources.length > 1
                ? width - 100
                : width
            }
            height={height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
          {model.isLoading ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.7)',
              }}
            >
              Loading...
            </div>
          ) : null}
        </div>
      </div>
    )
  },
)

export default WebGLMultiWiggleComponent
