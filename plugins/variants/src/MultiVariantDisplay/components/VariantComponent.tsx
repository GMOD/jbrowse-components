import { useEffect, useRef, useState } from 'react'

import { ErrorBar, Menu } from '@jbrowse/core/ui'
import {
  SimpleFeature,
  getBpDisplayStr,
  getContainingView,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { VariantRenderer } from './VariantRenderer.ts'
import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import LoadingOverlay from '../../shared/components/LoadingOverlay.tsx'
import { useVariantVirtualScroll } from '../../shared/useVariantVirtualScroll.ts'

import type { VariantCellData } from './computeVariantCells.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface PerRegionCellData {
  perRegionCellData: Record<number, VariantCellData>
}

export interface VariantDisplayModel {
  cellData: PerRegionCellData | undefined
  availableHeight: number
  rowHeight: number
  scrollTop: number
  totalHeight: number
  nrow: number
  sources: { name: string; baseName?: string }[] | undefined
  featuresVolatile: { id(): string; toJSON(): Record<string, unknown> }[] | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
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
  contextMenuItems: () => { label: string; onClick: () => void }[]
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

function buildFlatbushIndex(cellData: VariantCellData) {
  return Flatbush.from(cellData.flatbushData)
}

const HoveredCellHighlight = observer(function HoveredCellHighlight({
  cell,
  model,
}: {
  cell: {
    rowIndex: number
    genomicStart: number
    genomicEnd: number
    regionNumber: number
  }
  model: VariantDisplayModel
}) {
  const region = model.visibleRegions.find(
    r => r.regionNumber === cell.regionNumber,
  )
  if (!region) {
    return null
  }
  const blockWidth = region.screenEndPx - region.screenStartPx
  const regionLengthBp = region.end - region.start
  const pxPerBp = blockWidth / regionLengthBp
  const left =
    region.screenStartPx + (cell.genomicStart - region.start) * pxPerBp
  const right =
    region.screenStartPx + (cell.genomicEnd - region.start) * pxPerBp
  const top = cell.rowIndex * model.rowHeight - model.scrollTop
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: Math.max(right - left, 2),
        height: model.rowHeight,
        border: '1px solid rgba(0,0,0,0.5)',
        background: 'rgba(255,255,255,0.3)',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
})

const VariantComponent = observer(function VariantComponent({
  model,
}: {
  model: VariantDisplayModel
}) {
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const [hoveredCell, setHoveredCell] = useState<
    | {
        rowIndex: number
        genomicStart: number
        genomicEnd: number
        regionNumber: number
      }
    | undefined
  >()
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

    let lastCellData: PerRegionCellData | null = null
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
        const activeRegions: number[] = []
        for (const [regionNumStr, regionData] of Object.entries(
          cellData.perRegionCellData,
        )) {
          const regionNum = Number(regionNumStr)
          activeRegions.push(regionNum)
          renderer.uploadRegion(regionNum, regionData)
        }
        renderer.pruneStaleRegions(activeRegions)
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

  function getFeatureUnderMouse(
    rect: DOMRect,
    eventClientX: number,
    eventClientY: number,
  ) {
    const cellData = model.cellData
    if (!cellData) {
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

    const regionCellData = cellData.perRegionCellData[region.regionNumber]
    if (!regionCellData) {
      return undefined
    }

    const flatbushIndex = buildFlatbushIndex(regionCellData)

    const blockWidth = region.screenEndPx - region.screenStartPx
    const regionLengthBp = region.end - region.start
    const bpPerPx = regionLengthBp / blockWidth

    const genomicPos =
      region.start +
      ((mouseX - region.screenStartPx) / blockWidth) * regionLengthBp
    const rowFrac = (mouseY + model.scrollTop) / model.rowHeight

    const pxPadding = 5
    const bpPadding = pxPadding * bpPerPx
    const rowPadding = Math.max(0.5, pxPadding / model.rowHeight)
    const hits = flatbushIndex.search(
      genomicPos - bpPadding,
      rowFrac - rowPadding,
      genomicPos + bpPadding,
      rowFrac + rowPadding,
    )

    let bestIdx = -1
    let bestDist = Infinity
    for (const idx of hits) {
      const item = regionCellData.flatbushItems[idx]!
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
      const item = regionCellData.flatbushItems[bestIdx]!
      const info = regionCellData.featureGenotypeMap[item.featureId]!
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
        cell: {
          rowIndex: regionCellData.cellRowIndices[bestIdx]!,
          genomicStart: item.genomicStart,
          genomicEnd: item.genomicEnd,
          regionNumber: region.regionNumber,
        },
      }
    }
    return undefined
  }

  function enrichFeatureFromClick(
    result: NonNullable<ReturnType<typeof getFeatureUnderMouse>>,
    model: VariantDisplayModel,
  ) {
    const baseFeature = model.featuresVolatile?.find(
      f => f.id() === result.featureId,
    )
    if (!baseFeature) {
      return undefined
    }
    const cellData = model.cellData
    const info = cellData
      ? Object.values(cellData.perRegionCellData).find(
          r => r.featureGenotypeMap[result.featureId],
        )?.featureGenotypeMap[result.featureId]
      : undefined
    return new SimpleFeature({
      id: baseFeature.id(),
      data: {
        ...baseFeature.toJSON(),
        ...(info
          ? {
              REF: info.ref,
              ALT: info.alt,
              description: info.description,
              genotypes: info.genotypes,
            }
          : {}),
        clickedSample: result.name,
        clickedGenotype: result.genotype,
        clickedAlleles: result.alleles,
      },
    })
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
              const { featureId, cell, ...tooltip } = result
              model.setHoveredGenotype(tooltip)
              setHoveredCell(cell)
            } else {
              model.setHoveredGenotype(undefined)
              setHoveredCell(undefined)
            }
          }
        }}
        onMouseLeave={() => {
          if (lastHoveredRef.current !== undefined) {
            lastHoveredRef.current = undefined
            model.setHoveredGenotype(undefined)
            setHoveredCell(undefined)
          }
        }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
          const enriched = result
            ? enrichFeatureFromClick(result, model)
            : undefined
          if (enriched) {
            model.selectFeature(enriched)
          }
        }}
        onContextMenu={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const result = getFeatureUnderMouse(rect, e.clientX, e.clientY)
          const enriched = result
            ? enrichFeatureFromClick(result, model)
            : undefined
          if (enriched) {
            e.preventDefault()
            model.setContextMenuFeature(enriched)
            setContextMenuCoord([e.clientX, e.clientY])
          }
        }}
      />
      {hoveredCell ? (
        <HoveredCellHighlight cell={hoveredCell} model={model} />
      ) : null}
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
      {contextMenuCoord ? (
        <Menu
          open
          onMenuItemClick={(_, callback) => {
            callback()
            setContextMenuCoord(undefined)
          }}
          onClose={() => {
            setContextMenuCoord(undefined)
            model.setContextMenuFeature(undefined)
          }}
          anchorReference="anchorPosition"
          anchorPosition={{
            top: contextMenuCoord[1],
            left: contextMenuCoord[0],
          }}
          menuItems={model.contextMenuItems()}
        />
      ) : null}
    </div>
  )
})

export default VariantComponent
