import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getBpDisplayStr,
  getContainingView,
  useWebGLRenderer,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { WebGLVariantMatrixRenderer } from './WebGLVariantMatrixRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'

import type { MatrixCellData } from './computeVariantMatrixCells.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export interface VariantMatrixDisplayModel {
  webglCellData: MatrixCellData | undefined
  availableHeight: number
  rowHeight: number
  scrollTop: number
  sources: { name: string; baseName?: string }[] | undefined
  featuresVolatile: { id(): string }[] | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
  regionTooLargeReason: string
  featuresReady: boolean
  statusMessage?: string
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  selectFeature: (feature: { id(): string }) => void
}

const WebGLVariantMatrixComponent = observer(
  function WebGLVariantMatrixComponent({
    model,
  }: {
    model: VariantMatrixDisplayModel
  }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number | undefined>(undefined)
    const cellDataRef = useRef<MatrixCellData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const view = getContainingView(model) as LGV

    const { rendererRef, contextVersion } = useWebGLRenderer(
      canvasRef,
      canvas => new WebGLVariantMatrixRenderer(canvas),
      {
        onError: e => {
          setError(
            e instanceof Error ? e.message : 'WebGL initialization failed',
          )
        },
      },
    )

    // Upload pre-computed cell data from worker when it arrives
    useEffect(() => {
      const renderer = rendererRef.current
      const cellData = model.webglCellData
      if (!renderer || !cellData) {
        cellDataRef.current = null
        return
      }
      cellDataRef.current = cellData
      renderer.uploadCellData(cellData)
    }, [model.webglCellData, contextVersion])

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
      contextVersion,
    ])

    const lastHoveredRef = useRef<string | undefined>(undefined)

    const getFeatureUnderMouse = useCallback(
      (eventClientX: number, eventClientY: number) => {
        const cellData = cellDataRef.current
        const sources = model.sources
        if (!cellData || !sources?.length || cellData.numFeatures === 0) {
          return undefined
        }
        const w = Math.round(view.dynamicBlocks.totalWidthPx)
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) {
          return undefined
        }
        const mouseX = eventClientX - rect.left
        const mouseY = eventClientY - rect.top

        const featureIdx = Math.floor((mouseX / w) * cellData.numFeatures)
        const rowIdx = Math.floor((mouseY + model.scrollTop) / model.rowHeight)
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
            return {
              genotype,
              alleles,
              featureName: feature.name,
              description:
                feature.alt.length >= 3
                  ? 'multiple ALT alleles'
                  : feature.description,
              length: getBpDisplayStr(feature.length),
              name: source.name,
              featureId: feature.featureId,
            }
          }
        }
        return undefined
      },
      [model, view],
    )

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const result = getFeatureUnderMouse(e.clientX, e.clientY)
        const key = result
          ? `${result.name}:${result.genotype}:${result.featureId}`
          : undefined
        if (key !== lastHoveredRef.current) {
          lastHoveredRef.current = key
          if (result) {
            const { featureId, ...tooltip } = result
            model.setHoveredGenotype(tooltip)
          } else {
            model.setHoveredGenotype(undefined)
          }
        }
      },
      [getFeatureUnderMouse, model],
    )

    const handleMouseLeave = useCallback(() => {
      if (lastHoveredRef.current !== undefined) {
        lastHoveredRef.current = undefined
        model.setHoveredGenotype(undefined)
      }
    }, [model])

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        const cellData = cellDataRef.current
        const features = model.featuresVolatile
        if (!cellData || !features || cellData.numFeatures === 0) {
          return
        }
        const result = getFeatureUnderMouse(e.clientX, e.clientY)
        if (result) {
          const feature = features.find(f => f.id() === result.featureId)
          if (feature) {
            model.selectFeature(feature)
          }
        }
      },
      [getFeatureUnderMouse, model],
    )

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
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
        <LoadingOverlay
          statusMessage={
            model.regionTooLarge
              ? model.regionTooLargeReason
              : model.statusMessage || 'Computing display data'
          }
          isVisible={!model.webglCellData || model.regionTooLarge}
        />
      </div>
    )
  },
)

export default WebGLVariantMatrixComponent
