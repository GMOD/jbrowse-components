import { useCallback, useEffect, useRef, useState } from 'react'

import { ErrorBar } from '@jbrowse/core/ui'
import { getContainingView, measureText } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import MultiWiggleTooltip from './Tooltip.tsx'
import TreeSidebar from './TreeSidebar.tsx'
import DensityLegend from '../../shared/DensityLegend.tsx'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'
import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import YScaleBar from '../../shared/YScaleBar.tsx'
import { parseColor } from '../../shared/webglUtils.ts'
import {
  getRowTop,
  isOverlayMode,
  isSummaryFeature,
  makeRenderState,
  makeWhiskersSourceData,
} from '../../shared/wiggleComponentUtils.ts'

import type { ClusterHierarchyNode, HoveredTreeNode } from './treeTypes.ts'
import type {
  MultiWiggleDataResult,
  MultiWiggleSourceData,
} from '../../RenderMultiWiggleDataRPC/types.ts'
import type {
  SourceRenderData,
  WiggleRenderBlock,
} from '../../shared/WiggleRenderer.ts'
import type axisPropsFromTickScale from '../../shared/axisPropsFromTickScale.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
  }
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  setFeatureUnderMouse: (
    feat?: MultiWiggleDisplayModel['featureUnderMouse'],
  ) => void
}

const ScoreLegend = observer(function ScoreLegend({
  model,
  canvasWidth,
}: {
  model: MultiWiggleDisplayModel
  canvasWidth: number
}) {
  const { ticks, scaleType } = model
  const legend = `[${ticks!.values[0]?.toFixed(0)}-${ticks!.values[1]?.toFixed(0)}]${scaleType === 'log' ? ' (log)' : ''}`
  const len = measureText(legend, 12)
  const xpos = canvasWidth - len - 60
  return (
    <g>
      <rect
        x={xpos - 3}
        y={0}
        width={len + 6}
        height={16}
        fill="rgba(255,255,255,0.8)"
      />
      <text y={12} x={xpos} fontSize={12}>
        {legend}
      </text>
    </g>
  )
})

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const rendererRef = useRef<WiggleRenderer | null>(null)
  const [ready, setReady] = useState(false)
  const [drawn, setDrawn] = useState(false)

  const view = getContainingView(model) as LGV

  const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      return
    }
    canvasRef.current = canvas
    const renderer = WiggleRenderer.getOrCreate(canvas)
    rendererRef.current = renderer
    renderer
      .init()
      .then(ok => {
        if (!ok) {
          setError('GPU initialization failed')
        } else {
          setReady(true)
        }
      })
      .catch((e: unknown) => {
        setError(`GPU initialization error: ${e}`)
      })
  }, [])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    return autorun(() => {
      const dataMap = model.rpcDataMap
      if (dataMap.size === 0) {
        renderer.pruneRegions([])
        return
      }

      const modelSources = model.sources
      const defaultPosColor = parseColor(model.posColor)
      const defaultNegColor = parseColor(model.negColor)
      const { summaryScoreMode, renderingType } = model
      const overlay = isOverlayMode(renderingType)
      const activeRegions: number[] = []
      for (const [regionNumber, data] of dataMap) {
        activeRegions.push(regionNumber)
        const sourcesByName = Object.fromEntries(
          data.sources.map(s => [s.name, s]),
        )
        const orderedSources =
          modelSources.length > 0 ? modelSources : data.sources
        const sourcesData: SourceRenderData[] = []
        for (const [idx, orderedSource] of orderedSources.entries()) {
          const rpcSource = sourcesByName[orderedSource.name]
          if (!rpcSource) {
            continue
          }

          const posColor = orderedSource.color
            ? parseColor(orderedSource.color)
            : defaultPosColor
          const negColor = defaultNegColor
          const row = overlay ? 0 : idx

          if (summaryScoreMode === 'whiskers') {
            const isScatter =
              renderingType === 'multirowscatter' ||
              renderingType === 'scatter'
            for (const s of makeWhiskersSourceData(
              rpcSource,
              posColor,
              model.isDensityMode,
              isScatter,
              row,
            )) {
              sourcesData.push(s)
            }
          } else if (summaryScoreMode === 'min' || summaryScoreMode === 'max') {
            const scores =
              summaryScoreMode === 'min'
                ? rpcSource.featureMinScores
                : rpcSource.featureMaxScores
            sourcesData.push({
              featurePositions: rpcSource.featurePositions,
              featureScores: scores,
              numFeatures: rpcSource.numFeatures,
              color: posColor,
              rowIndex: row,
            })
          } else {
            if (rpcSource.posNumFeatures > 0) {
              sourcesData.push({
                featurePositions: rpcSource.posFeaturePositions,
                featureScores: rpcSource.posFeatureScores,
                numFeatures: rpcSource.posNumFeatures,
                color: posColor,
                rowIndex: row,
              })
            }
            if (rpcSource.negNumFeatures > 0) {
              sourcesData.push({
                featurePositions: rpcSource.negFeaturePositions,
                featureScores: rpcSource.negFeatureScores,
                numFeatures: rpcSource.negNumFeatures,
                color: negColor,
                rowIndex: row,
              })
            }
          }
        }

        renderer.uploadRegion(regionNumber, data.regionStart, sourcesData)
      }
      renderer.pruneRegions(activeRegions)
    })
  }, [model, ready])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    return autorun(() => {
      if (!view.initialized || !model.domain) {
        return
      }

      // access sources so MobX tracks it as a dependency,
      // ensuring re-render when source order/filtering changes
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _sources = model.sources

      const visibleRegions = view.visibleRegions
      if (visibleRegions.length === 0) {
        return
      }

      const totalWidth = Math.round(view.width)

      const blocks: WiggleRenderBlock[] = visibleRegions.map(vr => ({
        regionNumber: vr.regionNumber,
        bpRangeX: [vr.start, vr.end] as [number, number],
        screenStartPx: vr.screenStartPx,
        screenEndPx: vr.screenEndPx,
      }))

      renderer.renderBlocks(
        blocks,
        makeRenderState(
          model.domain,
          model.scaleType,
          model.renderingType,
          totalWidth,
          model.height,
        ),
      )
      if (!drawn) {
        setDrawn(true)
      }
    })
  }, [model, view, ready, drawn])

  const [offsetMouseCoord, setOffsetMouseCoord] = useState<[number, number]>([
    0, 0,
  ])
  const [clientMouseCoord, setClientMouseCoord] = useState<[number, number]>([
    0, 0,
  ])
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (!container) {
        return
      }
      const rect = container.getBoundingClientRect()
      const offsetX = event.clientX - rect.left
      const offsetY = event.clientY - rect.top
      setOffsetMouseCoord([offsetX, offsetY])
      setClientMouseCoord([event.clientX, event.clientY])

      const { rowHeight, sources, rpcDataMap, summaryScoreMode, domain } = model
      if (sources.length === 0 || rpcDataMap.size === 0) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const visibleRegions = view.visibleRegions
      const region = visibleRegions.find(
        r => offsetX >= r.screenStartPx && offsetX < r.screenEndPx,
      )
      if (!region) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const data = rpcDataMap.get(region.regionNumber)
      if (!data) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const blockWidth = region.screenEndPx - region.screenStartPx
      const frac = (offsetX - region.screenStartPx) / blockWidth
      const bp = Math.round(region.start + frac * (region.end - region.start))
      const bpOffset = bp - data.regionStart

      if (model.isOverlay && domain) {
        let bestSource: MultiWiggleSourceData | undefined
        let bestScore = 0
        let bestDist = Infinity
        let bestIdx = -1
        const mouseScore =
          domain[1] - ((offsetY / model.height) * (domain[1] - domain[0]))

        for (const src of data.sources) {
          if (!sources.some(s => s.name === src.name)) {
            continue
          }
          for (let i = 0; i < src.numFeatures; i++) {
            const fStart = src.featurePositions[i * 2]!
            const fEnd = src.featurePositions[i * 2 + 1]!
            if (bpOffset >= fStart && bpOffset < fEnd) {
              const dist = Math.abs(src.featureScores[i]! - mouseScore)
              if (dist < bestDist) {
                bestDist = dist
                bestSource = src
                bestScore = src.featureScores[i]!
                bestIdx = i
              }
              break
            }
          }
        }

        if (!bestSource || bestIdx === -1) {
          model.setFeatureUnderMouse(undefined)
          return
        }

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
        })
        return
      }

      const rowIdx = Math.floor(offsetY / rowHeight)
      if (rowIdx < 0 || rowIdx >= sources.length) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const sourceName = sources[rowIdx]!.name
      const rpcSource = data.sources.find(
        (s: MultiWiggleSourceData) => s.name === sourceName,
      )
      if (!rpcSource) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const { featurePositions, featureScores, numFeatures } = rpcSource
      let foundIdx = -1
      for (let i = 0; i < numFeatures; i++) {
        const fStart = featurePositions[i * 2]!
        const fEnd = featurePositions[i * 2 + 1]!
        if (bpOffset >= fStart && bpOffset < fEnd) {
          foundIdx = i
          break
        }
      }

      if (foundIdx === -1) {
        model.setFeatureUnderMouse(undefined)
        return
      }

      const fStart = featurePositions[foundIdx * 2]! + data.regionStart
      const fEnd = featurePositions[foundIdx * 2 + 1]! + data.regionStart
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
    },
    [model, view],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const totalWidth = Math.round(view.width)
  const height = model.height
  const scalebarLeft = model.scalebarOverlapLeft

  if (error !== null || model.error) {
    return (
      <div style={{ position: 'relative', width: totalWidth, height }}>
        <ErrorBar
          error={error ?? model.error}
          onRetry={() => {
            setError(null)
            model.reload()
          }}
        />
      </div>
    )
  }

  const numSources = model.numSources
  const rowHeight = model.rowHeight

  const displaySources = model.sources
  const labelWidth =
    displaySources.length > 0
      ? Math.max(...displaySources.map(s => measureText(s.name, 10))) + 10
      : 0
  const treeShowing = model.showTree && !!model.hierarchy
  const labelOffset = treeShowing ? model.treeAreaWidth : 0

  return (
    <div
      ref={containerRef}
      data-testid="multi-wiggle-display"
      style={{ position: 'relative', width: totalWidth, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div data-testid={`drawn-${drawn}`}>
        <canvas
          ref={canvasRefCallback}
          style={{
            width: totalWidth,
            height,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          width={totalWidth}
          height={height}
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
              offset={labelOffset}
            />
          ) : (
            <g transform={`translate(${labelOffset} 0)`}>
              {displaySources.map((source, idx) => {
                const y = getRowTop(idx, rowHeight)
                const boxHeight = Math.min(20, rowHeight)
                const lc = source.labelColor
                return (
                  <g key={source.name}>
                    <rect
                      x={0}
                      y={y}
                      width={labelWidth}
                      height={boxHeight}
                      fill={lc ?? 'rgba(255,255,255,0.8)'}
                    />
                    <text
                      x={4}
                      y={y + boxHeight / 2 + 3}
                      fontSize={10}
                      fill={lc ? 'white' : 'black'}
                    >
                      {source.name}
                    </text>
                  </g>
                )
              })}
            </g>
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
            <ScoreLegend model={model} canvasWidth={totalWidth} />
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
      </svg>

      <TreeSidebar model={model} />

      <MultiWiggleTooltip
        model={model}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
        height={height}
      />

      <LoadingOverlay
        statusMessage={model.statusMessage || 'Loading'}
        isVisible={model.isLoading}
      />
    </div>
  )
})

export default MultiWiggleComponent
