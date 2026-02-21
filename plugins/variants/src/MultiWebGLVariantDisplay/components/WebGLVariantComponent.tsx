import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { VariantRenderer } from './VariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'

import type { VariantCellData } from './computeVariantCells.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface VariantDisplayModel {
  webglCellData: VariantCellData | undefined
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
  visibleRegions: {
    refName: string
    regionNumber: number
    start: number
    end: number
    assemblyName: string
    screenStartPx: number
    screenEndPx: number
  }[]
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  selectFeature: (feature: { id(): string }) => void
  setContextMenuFeature: (feature?: { id(): string }) => void
}

type LGV = LinearGenomeViewModel

const WebGLVariantComponent = observer(function WebGLVariantComponent({
  model,
}: {
  model: VariantDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellDataRef = useRef<VariantCellData | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)

  const view = getContainingView(model) as LGV

  const rendererRef = useRef<VariantRenderer | null>(null)

  const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      return
    }
    canvasRef.current = canvas
    const renderer = VariantRenderer.getOrCreate(canvas)
    rendererRef.current = renderer
    renderer
      .init()
      .then(ok => {
        if (!ok) {
          console.error('[WebGLVariantComponent] GPU initialization failed')
          setError(new Error('GPU initialization failed'))
        } else {
          setReady(true)
        }
      })
      .catch((e: unknown) => {
        console.error('[WebGLVariantComponent] GPU initialization error:', e)
        setError(e)
      })
  }, [])

  // Upload pre-computed cell data from worker when it arrives
  useEffect(() => {
    const renderer = rendererRef.current
    const cellData = model.webglCellData
    if (!renderer || !ready || !cellData) {
      cellDataRef.current = null
      return
    }
    cellDataRef.current = cellData
    renderer.uploadCellData(cellData)
  }, [model.webglCellData, ready])

  // Render when view state changes
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready || !view.initialized) {
      return
    }

    const regions = model.visibleRegions
    if (regions.length === 0) {
      return
    }

    const width = Math.round(view.dynamicBlocks.totalWidthPx)
    const height = model.availableHeight

    const blocks = regions.map(r => ({
      regionNumber: r.regionNumber,
      bpRangeX: [r.start, r.end] as [number, number],
      screenStartPx: r.screenStartPx,
      screenEndPx: r.screenEndPx,
    }))

    renderer.renderBlocks(blocks, {
      canvasWidth: width,
      canvasHeight: height,
      rowHeight: model.rowHeight,
      scrollTop: model.scrollTop,
    })
  }, [
    model,
    model.webglCellData,
    model.availableHeight,
    model.rowHeight,
    model.scrollTop,
    model.sources,
    model.visibleRegions,
    view,
    view.initialized,
    view.bpPerPx,
    view.offsetPx,
    view.dynamicBlocks.totalWidthPx,
    ready,
  ])

  const lastHoveredRef = useRef<string | undefined>(undefined)

  const flatbushIndex = useMemo(
    () =>
      model.webglCellData?.flatbushData
        ? Flatbush.from(model.webglCellData.flatbushData)
        : null,
    [model.webglCellData],
  )

  const getFeatureUnderMouse = useCallback(
    (eventClientX: number, eventClientY: number) => {
      const canvas = canvasRef.current
      const cellData = cellDataRef.current
      if (!canvas || !cellData || !flatbushIndex) {
        return undefined
      }
      const rect = canvas.getBoundingClientRect()
      const mouseX = eventClientX - rect.left
      const mouseY = eventClientY - rect.top

      const regions = model.visibleRegions
      const region = regions.find(
        r => mouseX >= r.screenStartPx && mouseX < r.screenEndPx,
      )
      if (!region) {
        return undefined
      }

      const blockWidth = region.screenEndPx - region.screenStartPx
      const regionLengthBp = region.end - region.start
      const bpPerPx = regionLengthBp / blockWidth

      const genomicPos =
        region.start +
        ((mouseX - region.screenStartPx) / blockWidth) * regionLengthBp
      const rowFrac = (mouseY + model.scrollTop) / model.rowHeight

      const bpPadding = 10 * bpPerPx
      const hits = flatbushIndex.search(
        genomicPos - bpPadding,
        rowFrac - 0.5,
        genomicPos + bpPadding,
        rowFrac + 0.5,
      )

      let bestIdx = -1
      let bestDist = Infinity
      for (const idx of hits) {
        const item = cellData.flatbushItems[idx]!
        const dx =
          genomicPos < item.genomicStart
            ? item.genomicStart - genomicPos
            : genomicPos > item.genomicEnd
              ? genomicPos - item.genomicEnd
              : 0
        if (dx < bestDist) {
          bestDist = dx
          bestIdx = idx
        }
      }

      if (bestIdx >= 0) {
        const item = cellData.flatbushItems[bestIdx]!
        const info = cellData.featureGenotypeMap[item.featureId]!
        const genotype = info.genotypes[item.sourceName]!
        const alleles = makeSimpleAltString(genotype, info.ref, info.alt)
        return {
          genotype,
          alleles,
          featureName: info.name,
          description:
            info.alt.length >= 3
              ? 'multiple ALT alleles'
              : info.description,
          length: getBpDisplayStr(info.length),
          name: item.sourceName,
          featureId: item.featureId,
        }
      }
      return undefined
    },
    [model, flatbushIndex],
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

  const getFeatureAtMouse = useCallback(
    (e: React.MouseEvent) => {
      const cellData = cellDataRef.current
      const features = model.featuresVolatile
      if (!cellData || !features) {
        return undefined
      }
      const result = getFeatureUnderMouse(e.clientX, e.clientY)
      if (result) {
        return features.find(f => f.id() === result.featureId)
      }
      return undefined
    },
    [getFeatureUnderMouse, model],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const feature = getFeatureAtMouse(e)
      if (feature) {
        model.selectFeature(feature)
      }
    },
    [getFeatureAtMouse, model],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const feature = getFeatureAtMouse(e)
      if (feature) {
        model.setContextMenuFeature(feature)
      }
    },
    [getFeatureAtMouse, model],
  )

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
        ref={canvasRefCallback}
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
        onContextMenu={handleContextMenu}
      />
      <LoadingOverlay
        statusMessage={
          model.regionTooLarge
            ? model.regionTooLargeReason
            : model.statusMessage ||
              (!model.sources
                ? 'Loading samples'
                : !model.featuresReady
                  ? 'Loading features'
                  : 'Computing display data')
        }
        isVisible={
          !model.webglCellData ||
          model.webglCellDataLoading ||
          model.regionTooLarge
        }
      />
    </div>
  )
})

export default WebGLVariantComponent
