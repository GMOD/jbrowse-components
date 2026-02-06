import { useEffect, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { computeVariantMatrixCells } from './computeVariantMatrixCells.ts'
import { WebGLVariantMatrixRenderer } from './WebGLVariantMatrixRenderer.ts'

import type { MatrixCellData } from './computeVariantMatrixCells.ts'
import type { MultiWebGLVariantMatrixDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const WebGLVariantMatrixComponent = observer(
  function WebGLVariantMatrixComponent({
    model,
  }: {
    model: MultiWebGLVariantMatrixDisplayModel
  }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<WebGLVariantMatrixRenderer | null>(null)
    const rafRef = useRef<number>()
    const cellDataRef = useRef<MatrixCellData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const view = getContainingView(model) as LGV

    // Initialize WebGL renderer
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }
      try {
        rendererRef.current = new WebGLVariantMatrixRenderer(canvas)
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'WebGL initialization failed',
        )
      }
      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }
        rendererRef.current?.destroy()
        rendererRef.current = null
      }
    }, [])

    // Compute cell data and upload when features/settings change
    useEffect(() => {
      const renderer = rendererRef.current
      if (!renderer) {
        return
      }
      const features = model.featuresVolatile
      const sources = model.sources
      if (!features || !sources?.length) {
        return
      }

      const cellData = computeVariantMatrixCells({
        features,
        sources,
        renderingMode: model.renderingMode,
        minorAlleleFrequencyFilter: model.minorAlleleFrequencyFilter,
        lengthCutoffFilter: model.lengthCutoffFilter,
      })

      cellDataRef.current = cellData
      renderer.uploadCellData(cellData)
    }, [
      model.featuresVolatile,
      model.sources,
      model.renderingMode,
      model.minorAlleleFrequencyFilter,
      model.lengthCutoffFilter,
    ])

    // Render when scroll/size changes
    useEffect(() => {
      const renderer = rendererRef.current
      if (!renderer || !view.initialized) {
        return
      }
      const cellData = cellDataRef.current
      if (!cellData) {
        return
      }

      const width = Math.round(view.dynamicBlocks.totalWidthPx)
      const height = model.availableHeight

      rafRef.current = requestAnimationFrame(() => {
        renderer.render({
          canvasWidth: width,
          canvasHeight: height,
          rowHeight: model.rowHeight,
          scrollTop: model.scrollTop,
          numFeatures: cellData.numFeatures,
        })
      })

      return () => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }
      }
    }, [
      model,
      model.featuresVolatile,
      model.availableHeight,
      model.rowHeight,
      model.scrollTop,
      model.sources,
      view.initialized,
      view.dynamicBlocks.totalWidthPx,
    ])

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.availableHeight

    if (error) {
      return (
        <div style={{ width, height, color: 'red', padding: 10 }}>
          WebGL Error: {error}
        </div>
      )
    }

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
          onMouseMove={event => {
            const cellData = cellDataRef.current
            const sources = model.sources
            if (!cellData || !sources?.length || cellData.numFeatures === 0) {
              return
            }
            const rect = event.currentTarget.getBoundingClientRect()
            const mouseX = event.clientX - rect.left
            const mouseY = event.clientY - rect.top

            const featureIdx = Math.floor(
              (mouseX / width) * cellData.numFeatures,
            )
            const rowIdx = Math.floor(
              (mouseY + model.scrollTop) / model.rowHeight,
            )
            const source = sources[rowIdx]
            const feature = cellData.featureData[featureIdx]
            if (source && feature) {
              model.setHoveredGenotype({
                genotype: `${source.name}: ${feature.name || feature.ref}>${feature.alt?.join(',')}`,
                name: source.name,
              })
            } else {
              model.setHoveredGenotype(undefined)
            }
          }}
          onMouseLeave={() => {
            model.setHoveredGenotype(undefined)
          }}
          onClick={event => {
            const cellData = cellDataRef.current
            const features = model.featuresVolatile
            if (!cellData || !features || cellData.numFeatures === 0) {
              return
            }
            const rect = event.currentTarget.getBoundingClientRect()
            const mouseX = event.clientX - rect.left

            const featureIdx = Math.floor(
              (mouseX / width) * cellData.numFeatures,
            )
            const fd = cellData.featureData[featureIdx]
            if (fd) {
              const feature = features.find(f => f.id() === fd.featureId)
              if (feature) {
                model.selectFeature(feature)
              }
            }
          }}
        />
      </div>
    )
  },
)

export default WebGLVariantMatrixComponent
