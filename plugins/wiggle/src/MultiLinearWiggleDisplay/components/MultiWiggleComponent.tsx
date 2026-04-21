import { useCallback, useRef, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { getContainingView, useGpuModelLifecycle } from '@jbrowse/core/util'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiWiggleTooltip from './Tooltip.tsx'
import DensityLegend from '../../shared/DensityLegend.tsx'
import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import ScoreLegend from '../../shared/ScoreLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import {
  WiggleErrorBar,
  WiggleLoadingOverlay,
} from '../../shared/WiggleStatusOverlays.tsx'
import YScaleBar from '../../shared/YScaleBar.tsx'
import {
  findFeatureAtBp,
  getRowTop,
  hitTestMouse,
  isSummaryFeature,
} from '../../shared/wiggleComponentUtils.ts'

import type {
  MultiWiggleDataResult,
  MultiWiggleSourceData,
} from '../../RenderMultiWiggleDataRPC/types.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { WiggleBackend } from '../../shared/wiggleBackendTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from '@jbrowse/tree-sidebar'

type LGV = LinearGenomeViewModel

const COORD0: [number, number] = [0, 0]

export interface MultiWiggleDisplayModel {
  rpcDataMap: Map<number, MultiWiggleDataResult>
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
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
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
  startGpuBackendLifecycle: (backend: WiggleBackend) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startGpuBackendLifecycle / stopGpuBackendLifecycle / renderNow on
  // the MultiLinearWiggleDisplay model. Sources changes trigger a full
  // re-upload via the lifecycle's `getUploadInvalidationToken`.
  const { canvasRef, error, retry } = useGpuModelLifecycle(
    WiggleRenderer,
    model,
  )

  const view = getContainingView(model) as LGV

  const containerRef = useRef<HTMLDivElement>(null)
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)
  const [offsetMouseCoord, setOffsetMouseCoord] = useState(COORD0)

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
        const hit =
          sources.length === 0
            ? undefined
            : hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)

        if (!hit) {
          model.setFeatureUnderMouse(undefined)
        } else {
          const { region, data, bpOffset } = hit

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
            const visibleSourceNames = new Set(sources.map(s => s.name))

            for (const src of data.sources) {
              if (visibleSourceNames.has(src.name)) {
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
              const rpcSource = data.sources.find(s => s.name === sourceName)
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
            <SvgRowLabels
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

      <WiggleErrorBar model={model} />
      <WiggleLoadingOverlay model={model} />
    </div>
  )
})

export default MultiWiggleComponent
