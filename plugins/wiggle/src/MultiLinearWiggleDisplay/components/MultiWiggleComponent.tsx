import { useCallback, useRef, useState } from 'react'

import { ErrorOverlay } from '@jbrowse/core/ui'
import { getContainingView, useGpuBackend } from '@jbrowse/core/util'
import {
  DisplayErrorBar,
  DisplayLoadingOverlay,
} from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, TreeSidebar } from '@jbrowse/tree-sidebar'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import MultiWiggleTooltip from './Tooltip.tsx'
import { findOverlayHit, findRowHit } from './findHit.ts'
import OverlayColorLegend from '../../shared/OverlayColorLegend.tsx'
import ScoreLegend from '../../shared/ScoreLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import { getRowTop, hitTestMouse } from '../../shared/wiggleComponentUtils.ts'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

type LGV = LinearGenomeViewModel

const COORD0: [number, number] = [0, 0]

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startBackend / stopBackend / renderNow on
  // the MultiLinearWiggleDisplay model. Sources changes trigger a full
  // re-upload via the lifecycle's `getUploadInvalidationToken`.
  const { canvasRef, error, retry } = useGpuBackend(WiggleRenderer, model)

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

        const { rowHeight, sources, rpcDataMap, summaryScoreMode } = model
        const hit =
          sources.length === 0
            ? undefined
            : hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)

        if (!hit) {
          model.setFeatureUnderMouse(undefined)
        } else {
          const { region, data, bp } = hit
          const result = model.isOverlay
            ? findOverlayHit(
                data,
                sources,
                bp,
                region.refName,
                summaryScoreMode,
              )
            : findRowHit(
                data,
                sources,
                bp,
                offsetY,
                rowHeight,
                region.refName,
                summaryScoreMode,
              )
          model.setFeatureUnderMouse(result)
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
          overflow: 'hidden',
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
          <ScoreLegend
            domain={model.domain}
            scaleType={model.scaleType}
            canvasWidth={totalWidth}
          />
        ) : model.ticks && model.domain ? (
          model.rowHeightTooSmallForScalebar ? (
            <ScoreLegend
              domain={model.domain}
              scaleType={model.scaleType}
              canvasWidth={totalWidth}
            />
          ) : model.isOverlay ? (
            <g transform={`translate(${scalebarLeft || 50} 0)`}>
              <YScaleBar ticks={model.ticks} orientation="left" />
            </g>
          ) : (
            <g transform={`translate(${scalebarLeft || 50} 0)`}>
              {Array.from({ length: numSources }).map((_, idx) => (
                <g
                  transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
                  key={`scalebar-${idx}`}
                >
                  <YScaleBar ticks={model.ticks} orientation="left" />
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
            ? model.ticks.items.map(({ value, y }) => (
                <line
                  key={`ch-${value}`}
                  x1={0}
                  x2={totalWidth}
                  y1={y}
                  y2={y}
                  stroke="rgba(200,200,200,0.8)"
                  strokeWidth={1}
                />
              ))
            : Array.from({ length: numSources }).map((_, rowIdx) => {
                const top = getRowTop(rowIdx, rowHeight)
                return model.ticks!.items.map(({ value, y: tickY }) => {
                  const y = top + tickY
                  if (y < top || y > top + rowHeight) {
                    return null
                  }
                  return (
                    <line
                      key={`ch-${rowIdx}-${value}`}
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

      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay model={model} />
    </div>
  )
})

export default MultiWiggleComponent
