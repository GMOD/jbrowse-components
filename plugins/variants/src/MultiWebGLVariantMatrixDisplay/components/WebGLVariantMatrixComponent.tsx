import { useEffect, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLVariantMatrixRenderer } from './WebGLVariantMatrixRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'

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

    // Upload pre-computed cell data from worker when it arrives
    useEffect(() => {
      const renderer = rendererRef.current
      const cellData = model.webglCellData
      if (!renderer || !cellData) {
        return
      }
      cellDataRef.current = cellData
      renderer.uploadCellData(cellData)
    }, [model.webglCellData])

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
      model.webglCellData,
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
            backgroundColor:
              model.referenceDrawingMode === 'skip' ? '#ccc' : undefined,
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
              const sampleName = source.baseName ?? source.name
              const genotype = feature.genotypes[sampleName]
              if (genotype) {
                const alleles = makeSimpleAltString(
                  genotype,
                  feature.ref,
                  feature.alt,
                )
                model.setHoveredGenotype({
                  genotype,
                  alleles,
                  featureName: feature.name,
                  description:
                    feature.alt.length >= 3
                      ? 'multiple ALT alleles'
                      : feature.description,
                  length: getBpDisplayStr(feature.length),
                  name: source.name,
                })
              } else {
                model.setHoveredGenotype(undefined)
              }
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
        {!model.webglCellData || model.regionTooLarge ? (
          <LoadingOverlay model={model} />
        ) : null}
      </div>
    )
  },
)

export default WebGLVariantMatrixComponent
