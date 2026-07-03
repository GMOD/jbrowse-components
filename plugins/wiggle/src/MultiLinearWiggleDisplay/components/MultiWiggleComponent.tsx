import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { TreeSidebar, treeSidebarRightEdge } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { findOverlayHit, findRowHit } from './findHit.ts'
import NoDataMessage from '../../shared/NoDataMessage.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { useWiggleMouseHandlers } from '../../shared/useWiggleMouseHandlers.ts'
import { getRowTop, hitTestMouse } from '../../shared/wiggleComponentUtils.ts'
import MultiWiggleSvgScales from '../MultiWiggleSvgScales.tsx'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

type LGV = LinearGenomeViewModel

const MultiWiggleComponent = observer(function MultiWiggleComponent({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on
  // the MultiLinearWiggleDisplay model. Sources changes trigger a full
  // re-upload via the lifecycle's `getUploadInvalidationToken`.
  const view = getContainingView(model) as LGV
  const totalWidth = view.trackWidthPx
  const height = model.height

  const computeHit = useCallback(
    (offsetX: number, offsetY: number) => {
      const { rowHeight, sources, rpcDataMap, summaryScoreMode } = model
      const hit =
        sources.length === 0
          ? undefined
          : hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)
      return hit
        ? model.isOverlay
          ? findOverlayHit(
              hit.data,
              sources,
              hit.bp,
              hit.region.refName,
              summaryScoreMode,
            )
          : findRowHit(
              hit.data,
              sources,
              hit.bp,
              offsetY,
              rowHeight,
              hit.region.refName,
              summaryScoreMode,
            )
        : undefined
    },
    [model, view],
  )

  const {
    containerRef,
    clientMouseCoord,
    offsetMouseCoord,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  } = useWiggleMouseHandlers(model, computeHit)

  return (
    <DisplayChrome
      model={model}
      factory={WiggleRenderer}
      ref={containerRef}
      testid="multi-wiggle-display"
      style={{
        width: totalWidth,
        height,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {({ canvasRef }) => (
        <MultiWiggleBody
          model={model}
          canvasRef={canvasRef}
          totalWidth={totalWidth}
          height={height}
          clientMouseCoord={clientMouseCoord}
          offsetMouseCoord={offsetMouseCoord}
        />
      )}
    </DisplayChrome>
  )
})

const MultiWiggleBody = observer(function MultiWiggleBody({
  model,
  canvasRef,
  totalWidth,
  height,
  clientMouseCoord,
  offsetMouseCoord,
}: {
  model: MultiWiggleDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  totalWidth: number
  height: number
  clientMouseCoord: [number, number]
  offsetMouseCoord: [number, number]
}) {
  const scalebarLeft = model.scalebarOverlapLeft
  const numSources = model.numSources
  const rowHeight = model.rowHeight
  const treeShowing = model.showTree && !!model.hierarchy
  const labelOffset = treeShowing ? model.treeAreaWidth : 0

  return (
    <>
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
        <MultiWiggleSvgScales
          model={model}
          canvasWidth={totalWidth}
          scalebarLeft={scalebarLeft || 50}
          labelOffset={labelOffset}
        />

        {!model.isOverlay && model.showRowSeparators && numSources > 1
          ? Array.from({ length: numSources - 1 }).map((_, idx) => {
              const y = getRowTop(idx + 1, rowHeight)
              return (
                <line
                  // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, one separator per row boundary
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
          ? // overlay draws one set of hatches over the full height (rowHeight
            // === height, top === 0); rows repeat them per source.
            Array.from({ length: model.isOverlay ? 1 : numSources }).map(
              (_, rowIdx) => {
                const top = getRowTop(rowIdx, rowHeight)
                return model.ticks!.items.map(({ value, y: tickY }) => (
                  <line
                    // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed positional list, tick values can repeat across rows
                    key={`ch-${rowIdx}-${value}`}
                    x1={0}
                    x2={totalWidth}
                    y1={top + tickY}
                    y2={top + tickY}
                    stroke="rgba(200,200,200,0.8)"
                    strokeWidth={1}
                  />
                ))
              },
            )
          : null}
      </svg>

      <TreeSidebar model={model} />

      {model.hasNoData ? (
        <NoDataMessage width={totalWidth} height={height} />
      ) : null}

      <WiggleTooltip
        model={model}
        height={height}
        clientMouseCoord={clientMouseCoord}
        offsetMouseCoord={offsetMouseCoord}
        minLeft={treeSidebarRightEdge(model)}
      />
    </>
  )
})

export default MultiWiggleComponent
