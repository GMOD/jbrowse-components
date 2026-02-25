import { useEffect, useRef, useState } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import { getBpDisplayStr, getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { VariantRenderer } from './VariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { VariantCellData } from './computeVariantCells.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface VariantDisplayModel {
  cellData: VariantCellData | undefined
  availableHeight: number
  rowHeight: number
  scrollTop: number
  totalHeight: number
  nrow: number
  sources: { name: string; baseName?: string }[] | undefined
  featuresVolatile: { id(): string }[] | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
  regionTooLargeReason: string
  featuresReady: boolean
  cellDataLoading: boolean
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
  displayError: unknown
  reload: () => void
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  setScrollTop: (n: number) => void
  setRowHeight: (n: number) => void
  selectFeature: (feature: { id(): string }) => void
  setContextMenuFeature: (feature?: { id(): string }) => void
  retryLoadingData: () => void
}

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  scrollbarTrack: {
    position: 'absolute' as const,
    right: 0,
    width: 12,
    cursor: 'default',
    zIndex: 10,
    '&:hover > *': {
      background: 'rgba(0,0,0,0.55)',
    },
  },
  scrollbarThumb: {
    position: 'absolute' as const,
    right: 2,
    width: 6,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
  },
})

const VariantComponent = observer(function VariantComponent({
  model,
}: {
  model: VariantDisplayModel
}) {
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)
  const rendererRef = useRef<VariantRenderer | null>(null)
  const lastHoveredRef = useRef<string | undefined>(undefined)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { classes } = useStyles()

  const view = getContainingView(model) as LGV

  const { hasOverflow, thumbHeight, thumbTop, handleScrollbarMouseDown } =
    useVariantVirtualScroll({
      canvasRef,
      scrollTop: model.scrollTop,
      setScrollTop: model.setScrollTop,
      totalHeight: model.totalHeight,
      viewportHeight: model.availableHeight,
      scrollZoom: view.scrollZoom,
      rowHeight: model.rowHeight,
      nrow: model.nrow,
      setRowHeight: model.setRowHeight,
    })

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    let lastCellData: VariantCellData | null = null
    return autorun(() => {
      if (!view.initialized) {
        return
      }

      const cellData = model.cellData
      if (!cellData) {
        lastCellData = null
        return
      }

      if (lastCellData !== cellData) {
        lastCellData = cellData
        renderer.uploadCellData(cellData)
      }

      const regions = model.visibleRegions
      if (regions.length === 0) {
        return
      }

      const blocks = regions.map(r => ({
        regionNumber: r.regionNumber,
        bpRangeX: [r.start, r.end] as [number, number],
        screenStartPx: r.screenStartPx,
        screenEndPx: r.screenEndPx,
      }))

      renderer.renderBlocks(blocks, {
        canvasWidth: view.trackWidthPx,
        canvasHeight: model.availableHeight,
        rowHeight: model.rowHeight,
        scrollTop: model.scrollTop,
      })
    })
  }, [model, view, ready])

  const flatbushIndex = model.cellData?.flatbushData
    ? Flatbush.from(model.cellData.flatbushData)
    : null

  function getFeatureUnderMouse(
    rect: DOMRect,
    eventClientX: number,
    eventClientY: number,
  ) {
    const cellData = model.cellData
    if (!cellData || !flatbushIndex) {
      return undefined
    }
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
      return {
        genotype,
        alleles: makeSimpleAltString(genotype, info.ref, info.alt),
        featureName: info.name,
        description:
          info.alt.length >= 3 ? 'multiple ALT alleles' : info.description,
        length: getBpDisplayStr(info.length),
        name: item.sourceName,
        featureId: item.featureId,
      }
    }
    return undefined
  }

  const width = view.trackWidthPx
  const height = model.availableHeight

  if (error) {
    return (
      <div style={{ position: 'relative', width, height }}>
        <ErrorBar
          error={error}
          onRetry={() => {
            rendererRef.current = null
            setError(null)
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvas => {
          canvasRef.current = canvas
          if (!canvas) {
            return
          }
          if (!rendererRef.current) {
            const renderer = VariantRenderer.getOrCreate(canvas)
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
      {hasOverflow ? (
        <div
          className={classes.scrollbarTrack}
          style={{ top: 0, height }}
          onMouseDown={handleScrollbarMouseDown}
        >
          <div
            className={classes.scrollbarThumb}
            style={{ top: thumbTop, height: thumbHeight }}
          />
        </div>
      ) : null}
      {model.regionTooLarge ? <TooLargeMessage model={model} /> : null}
      <LoadingOverlay
        statusMessage={
          model.statusMessage ||
          (!model.sources
            ? 'Loading samples'
            : !model.featuresReady
              ? 'Loading features'
              : 'Computing display data')
        }
        isVisible={
          !model.displayError &&
          !model.regionTooLarge &&
          (!model.cellData || model.cellDataLoading)
        }
      />
      {model.displayError ? (
        <ErrorBar
          error={model.displayError}
          onRetry={() => {
            model.retryLoadingData()
          }}
        />
      ) : null}
    </div>
  )
})

export default VariantComponent
