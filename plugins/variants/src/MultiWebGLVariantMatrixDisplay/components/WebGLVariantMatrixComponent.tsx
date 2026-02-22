import { useEffect, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { VariantMatrixRenderer } from './VariantMatrixRenderer.ts'
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
  webglCellDataLoading: boolean
  statusMessage?: string
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  selectFeature: (feature: { id(): string }) => void
  setContextMenuFeature: (feature?: { id(): string }) => void
}

const WebGLVariantMatrixComponent = observer(
  function WebGLVariantMatrixComponent({
    model,
  }: {
    model: VariantMatrixDisplayModel
  }) {
    const [error, setError] = useState<unknown>(null)
    const [ready, setReady] = useState(false)
    const rendererRef = useRef<VariantMatrixRenderer | null>(null)
    const lastHoveredRef = useRef<string | undefined>(undefined)

    const view = getContainingView(model) as LGV

    useEffect(() => {
      const renderer = rendererRef.current
      if (!renderer || !ready) {
        return
      }

      let lastCellData: MatrixCellData | null = null
      return autorun(() => {
        if (!view.initialized) {
          return
        }
        const cellData = model.webglCellData as MatrixCellData | undefined
        if (!cellData) {
          lastCellData = null
          return
        }

        if (lastCellData !== cellData) {
          lastCellData = cellData
          renderer.uploadCellData(cellData)
        }

        renderer.render({
          canvasWidth: Math.round(view.dynamicBlocks.totalWidthPx),
          canvasHeight: model.availableHeight,
          rowHeight: model.rowHeight,
          scrollTop: model.scrollTop,
          numFeatures: cellData.numFeatures,
        })
      })
    }, [model, view, ready])

    function getFeatureUnderMouse(
      rect: DOMRect,
      eventClientX: number,
      eventClientY: number,
    ) {
      const cellData = model.webglCellData
      const sources = model.sources
      if (!cellData || !sources?.length || cellData.numFeatures === 0) {
        return undefined
      }
      const w = Math.round(view.dynamicBlocks.totalWidthPx)
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
          return {
            genotype,
            alleles: makeSimpleAltString(genotype, feature.ref, feature.alt),
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
    }

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.availableHeight

    if (error) {
      return (
        <div style={{ width, height, color: 'red', padding: 10 }}>
          GPU Error: {`${error}`}
        </div>
      )
    }

    return (
      <div style={{ position: 'relative', width, height }}>
        <canvas
          ref={canvas => {
            if (!canvas) {
              return
            }
            if (!rendererRef.current) {
              const renderer = VariantMatrixRenderer.getOrCreate(canvas)
              rendererRef.current = renderer
              renderer
                .init()
                .then(ok => {
                  if (!ok) {
                    setError(new Error('GPU initialization failed'))
                  } else {
                    setReady(true)
                  }
                })
                .catch((e: unknown) => {
                  setError(e)
                })
            }
          }}
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
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
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
          }}
          onMouseLeave={() => {
            if (lastHoveredRef.current !== undefined) {
              lastHoveredRef.current = undefined
              model.setHoveredGenotype(undefined)
            }
          }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
            const feature = result
              ? model.featuresVolatile?.find(f => f.id() === result.featureId)
              : undefined
            if (feature) {
              model.selectFeature(feature)
            }
          }}
          onContextMenu={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
            const feature = result
              ? model.featuresVolatile?.find(f => f.id() === result.featureId)
              : undefined
            if (feature) {
              model.setContextMenuFeature(feature)
            }
          }}
        />
        <LoadingOverlay
          statusMessage={
            model.regionTooLarge
              ? model.regionTooLargeReason
              : model.statusMessage || 'Computing display data'
          }
          isVisible={
            !model.webglCellData ||
            model.webglCellDataLoading ||
            model.regionTooLarge
          }
        />
      </div>
    )
  },
)

export default WebGLVariantMatrixComponent
