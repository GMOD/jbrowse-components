import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import { ErrorBar, ErrorOverlay } from '@jbrowse/core/ui'
import {
  getContainingView,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { TreeSidebar } from '@jbrowse/tree-sidebar'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import MultiWiggleTooltip from './Tooltip.tsx'
import { buildMultiSourceRenderData } from './buildMultiSourceRenderData.ts'
import DensityLegend from '../../shared/DensityLegend.tsx'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import MultiRowLabels from '../../shared/MultiRowLabels.tsx'
import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import ScoreLegend from '../../shared/ScoreLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'
import {
  findFeatureAtBp,
  getRowTop,
  isSummaryFeature,
  makeRenderState,
} from '../../shared/wiggleComponentUtils.ts'

import type {
  MultiWiggleDataResult,
  MultiWiggleSourceData,
} from '../../RenderMultiWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { WiggleRenderBlock } from '../../shared/wiggleBackendTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from '@jbrowse/tree-sidebar'

type LGV = LinearGenomeViewModel

export interface MultiWiggleDisplayModel {
  rpcDataMap: Map<number, MultiWiggleDataResult>
  dataVersion: number
  sources: { name: string; color?: string; labelColor?: string }[]
  height: number
  domain: [number, number] | undefined
  scaleType: string
  posColor: string
  negColor: string
  renderingType: string
  isDensityMode: boolean
  isOverlay: boolean
  summaryScoreMode: string
  numSources: number
  rowHeight: number
  rowHeightTooSmallForScalebar: boolean
  ticks?: ReturnType<typeof axisPropsFromTickScale>
  error: Error | null
  isLoading: boolean
  statusMessage?: string
  displayCrossHatches: boolean
  reload: () => void
  scalebarOverlapLeft: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  showTree: boolean
  showRowSeparators: boolean
  subtreeFilter?: string[]
  hoveredTreeNode?: HoveredTreeNode
  treeCanvas?: HTMLCanvasElement
  mouseoverCanvas?: HTMLCanvasElement
  featureUnderMouse?: {
    refName: string
    start: number
    end: number
    score: number
    minScore?: number
    maxScore?: number
    source: string
    summary?: boolean
    allSources?: {
      source: string
      score: number
      minScore?: number
      maxScore?: number
      summary?: boolean
    }[]
  }
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  setFeatureUnderMouse: (
    feat?: MultiWiggleDisplayModel['featureUnderMouse'],
  ) => void
  selectFeature: (
    feat: NonNullable<MultiWiggleDisplayModel['featureUnderMouse']>,
  ) => void
  canvasDrawn: boolean
  setCanvasDrawn: (flag: boolean) => void
}

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { error, ready, rendererRef, retry } = useGpuRenderer(
    canvasRef,
    WiggleRenderer,
  )

  const view = getContainingView(model) as LGV

  const renderNow = useEffectEvent(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized) {
      return
    }
    const { domain } = model
    const visibleRegions = view.visibleRegions
    const totalWidth = view.trackWidthPx
    if (!domain || visibleRegions.length === 0) {
      return
    }
    const blocks: WiggleRenderBlock[] = visibleRegions.map(vr => ({
      regionNumber: vr.regionNumber,
      bpRangeX: [vr.start, vr.end] as [number, number],
      screenStartPx: vr.screenStartPx,
      screenEndPx: vr.screenEndPx,
      reversed: vr.reversed ?? false,
    }))
    renderer.renderBlocks(
      blocks,
      makeRenderState(
        domain,
        model.scaleType,
        model.renderingType,
        totalWidth,
        model.height,
      ),
    )
  })

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    let lastDataMap: unknown = null

    return autorun(() => {
      const dataMap = model.rpcDataMap

      if (lastDataMap !== dataMap) {
        lastDataMap = dataMap
        if (dataMap.size === 0) {
          renderer.pruneRegions([])
        } else {
          const { summaryScoreMode, renderingType, isDensityMode } = model
          const defaultPosColor = parseColor(model.posColor)
          const defaultNegColor = parseColor(model.negColor)
          const activeRegions: number[] = []
          for (const [regionNumber, data] of dataMap) {
            activeRegions.push(regionNumber)
            const sourcesData = buildMultiSourceRenderData(
              data,
              model.sources,
              defaultPosColor,
              defaultNegColor,
              summaryScoreMode,
              renderingType,
              isDensityMode,
            )
            renderer.uploadRegion(regionNumber, data.regionStart, sourcesData)
          }
          renderer.pruneRegions(activeRegions)
        }
      }

      // SYNC across all hook-driven GPU displays (wiggle, multi-wiggle,
      // variants, alignments, HiC, LD): dataVersion is a counter incremented
      // by setLoadedRegionForRegion() after each region's data is committed.
      // Reading it here creates a MobX dependency so this autorun re-fires at
      // that point, ensuring renderNow() runs with fully-committed data.
      // See MultiRegionDisplayMixin.withFetchLifecycle.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _dv = model.dataVersion

      renderNow()
      if (dataMap.size > 0 && model.domain) {
        model.setCanvasDrawn(true)
      }
    })
  }, [model, view, ready, rendererRef])

  useTabVisibilityRerender(renderNow)

  const containerRef = useRef<HTMLDivElement>(null)
  const coord0: [number, number] = [0, 0]
  const [clientMouseCoord, setClientMouseCoord] = useState(coord0)
  const [offsetMouseCoord, setOffsetMouseCoord] = useState(coord0)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top

        setClientMouseCoord([event.clientX, event.clientY])
        setOffsetMouseCoord([offsetX, offsetY])

        const { rowHeight, sources, rpcDataMap, summaryScoreMode, domain } =
          model
        const visibleRegions = view.visibleRegions
        const region = visibleRegions.find(
          r => offsetX >= r.screenStartPx && offsetX < r.screenEndPx,
        )
        const data = region ? rpcDataMap.get(region.regionNumber) : undefined

        if (sources.length === 0 || rpcDataMap.size === 0 || !region || !data) {
          model.setFeatureUnderMouse(undefined)
        } else {
          const blockWidth = region.screenEndPx - region.screenStartPx
          const frac = (offsetX - region.screenStartPx) / blockWidth
          const bp = region.reversed
            ? Math.round(region.end - frac * (region.end - region.start))
            : Math.round(region.start + frac * (region.end - region.start))
          const bpOffset = bp - data.regionStart

          if (model.isOverlay && domain) {
            let bestSource: MultiWiggleSourceData | undefined
            let bestScore = 0
            let bestDist = Infinity
            let bestIdx = -1
            const mouseScore =
              domain[1] - (offsetY / model.height) * (domain[1] - domain[0])
            const allSources: NonNullable<
              MultiWiggleDisplayModel['featureUnderMouse']
            >['allSources'] = []

            for (const src of data.sources) {
              if (sources.some(s => s.name === src.name)) {
                const i = findFeatureAtBp(
                  src.featurePositions,
                  src.numFeatures,
                  bpOffset,
                )
                if (i !== -1) {
                  const score = src.featureScores[i]!
                  const minS = src.featureMinScores[i]
                  const maxS = src.featureMaxScores[i]
                  const dist = Math.abs(score - mouseScore)
                  if (dist < bestDist) {
                    bestDist = dist
                    bestSource = src
                    bestScore = score
                    bestIdx = i
                  }
                  allSources.push({
                    source: src.name,
                    score,
                    ...(summaryScoreMode !== 'avg' &&
                    isSummaryFeature(score, minS, maxS)
                      ? { summary: true, minScore: minS, maxScore: maxS }
                      : {}),
                  })
                }
              }
            }

            if (!bestSource || bestIdx === -1) {
              model.setFeatureUnderMouse(undefined)
            } else {
              const fStart =
                bestSource.featurePositions[bestIdx * 2]! + data.regionStart
              const fEnd =
                bestSource.featurePositions[bestIdx * 2 + 1]! + data.regionStart
              const minS = bestSource.featureMinScores[bestIdx]
              const maxS = bestSource.featureMaxScores[bestIdx]

              model.setFeatureUnderMouse({
                refName: region.refName,
                start: fStart,
                end: fEnd,
                score: bestScore,
                source: bestSource.name,
                ...(summaryScoreMode !== 'avg' &&
                isSummaryFeature(bestScore, minS, maxS)
                  ? { summary: true, minScore: minS, maxScore: maxS }
                  : {}),
                allSources,
              })
            }
          } else {
            const rowIdx = Math.floor(offsetY / rowHeight)
            if (rowIdx < 0 || rowIdx >= sources.length) {
              model.setFeatureUnderMouse(undefined)
            } else {
              const sourceName = sources[rowIdx]!.name
              const rpcSource = data.sources.find(
                (s: MultiWiggleSourceData) => s.name === sourceName,
              )
              if (!rpcSource) {
                model.setFeatureUnderMouse(undefined)
              } else {
                const { featurePositions, featureScores, numFeatures } =
                  rpcSource
                const foundIdx = findFeatureAtBp(
                  featurePositions,
                  numFeatures,
                  bpOffset,
                )

                if (foundIdx === -1) {
                  model.setFeatureUnderMouse(undefined)
                } else {
                  const fStart =
                    featurePositions[foundIdx * 2]! + data.regionStart
                  const fEnd =
                    featurePositions[foundIdx * 2 + 1]! + data.regionStart
                  const score = featureScores[foundIdx]!
                  const minScore = rpcSource.featureMinScores[foundIdx]
                  const maxScore = rpcSource.featureMaxScores[foundIdx]

                  model.setFeatureUnderMouse({
                    refName: region.refName,
                    start: fStart,
                    end: fEnd,
                    score,
                    source: sourceName,
                    ...(summaryScoreMode !== 'avg' &&
                    isSummaryFeature(score, minScore, maxScore)
                      ? { summary: true, minScore, maxScore }
                      : {}),
                  })
                }
              }
            }
          }
        }
      }
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const handleClick = useCallback(() => {
    const feat = model.featureUnderMouse
    if (feat) {
      model.selectFeature(feat)
    }
  }, [model])

  const totalWidth = view.trackWidthPx
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={totalWidth}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  const numSources = model.numSources
  const rowHeight = model.rowHeight

  const displaySources = model.sources
  const treeShowing = model.showTree && !!model.hierarchy
  const labelOffset = treeShowing ? model.treeAreaWidth : 0

  return (
    <div
      ref={containerRef}
      data-testid={
        model.canvasDrawn ? 'multi-wiggle-display-done' : 'multi-wiggle-display'
      }
      style={{
        position: 'relative',
        width: totalWidth,
        height,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div>
        <canvas
          ref={canvasRef}
          style={{
            width: totalWidth,
            height,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        />
      </div>

      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          height,
          width: totalWidth,
        }}
      >
        {displaySources.length > 1 ? (
          model.isOverlay ? (
            <OverlayColorLegend
              sources={displaySources}
              fallbackColor={model.posColor}
              canvasWidth={totalWidth}
            />
          ) : (
            <MultiRowLabels
              sources={displaySources}
              rowHeight={rowHeight}
              labelOffset={labelOffset}
            />
          )
        ) : null}

        {model.isDensityMode && model.domain ? (
          <DensityLegend
            domain={model.domain}
            scaleType={model.scaleType}
            canvasWidth={totalWidth}
          />
        ) : model.ticks ? (
          model.rowHeightTooSmallForScalebar ? (
            <ScoreLegend
              ticks={model.ticks}
              scaleType={model.scaleType}
              canvasWidth={totalWidth}
            />
          ) : model.isOverlay ? (
            <g transform={`translate(${scalebarLeft || 50} 0)`}>
              <YScaleBar model={model} />
            </g>
          ) : (
            <g transform={`translate(${scalebarLeft || 50} 0)`}>
              {Array.from({ length: numSources }).map((_, idx) => (
                <g
                  transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
                  key={`scalebar-${idx}`}
                >
                  <YScaleBar model={model} />
                </g>
              ))}
            </g>
          )
        ) : null}

        {!model.isOverlay && model.showRowSeparators && numSources > 1
          ? Array.from({ length: numSources - 1 }).map((_, idx) => {
              const y = getRowTop(idx + 1, rowHeight)
              return (
                <line
                  key={`sep-${idx}`}
                  x1={0}
                  y1={y}
                  x2={totalWidth}
                  y2={y}
                  stroke="#0003"
                  strokeWidth={1}
                />
              )
            })
          : null}

        {model.displayCrossHatches && model.ticks
          ? model.isOverlay
            ? model.ticks.values.map((v, idx) => {
                const pos = model.ticks!.position(v)
                if (!Number.isFinite(pos)) {
                  return null
                }
                return (
                  <line
                    key={`ch-${idx}`}
                    x1={0}
                    x2={totalWidth}
                    y1={pos}
                    y2={pos}
                    stroke="rgba(200,200,200,0.8)"
                    strokeWidth={1}
                  />
                )
              })
            : Array.from({ length: numSources }).map((_, rowIdx) => {
                const top = getRowTop(rowIdx, rowHeight)
                return model.ticks!.values.map((v, idx) => {
                  const pos = model.ticks!.position(v)
                  if (!Number.isFinite(pos)) {
                    return null
                  }
                  const y = top + pos
                  if (y < top || y > top + rowHeight) {
                    return null
                  }
                  return (
                    <line
                      key={`ch-${rowIdx}-${idx}`}
                      x1={0}
                      x2={totalWidth}
                      y1={y}
                      y2={y}
                      stroke="rgba(200,200,200,0.8)"
                      strokeWidth={1}
                    />
                  )
                })
              })
          : null}
      </svg>

      <TreeSidebar model={model} />

      <MultiWiggleTooltip
        model={model}
        height={height}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
      />

      {model.error ? (
        <ErrorBar
          error={model.error}
          onRetry={() => {
            model.reload()
          }}
        />
      ) : null}
      <LoadingOverlay
        statusMessage={model.statusMessage || 'Loading'}
        isVisible={model.isLoading}
      />
    </div>
  )
})

export default MultiWiggleComponent
