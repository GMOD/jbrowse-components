import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import {
  CrossHatches,
  YSCALEBAR_LABEL_OFFSET,
  YScaleBarOverlay,
} from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend from '../../shared/ScoreLegend.tsx'
import WiggleCursorLine from '../../shared/WiggleCursorLine.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { useWiggleMouseHandlers } from '../../shared/useWiggleMouseHandlers.ts'
import {
  findSourceHit,
  hitTestMouse,
  legendRightEdgePx,
} from '../../shared/wiggleComponentUtils.ts'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on the
  // LinearWiggleDisplay model. This component is just a thin bridge that
  // plugs the canvas and the backend into those model actions.
  const view = getContainingView(model) as LGV
  const width = view.trackWidthPx
  const height = model.height

  const computeHit = useCallback(
    (offsetX: number) => {
      const { rpcDataMap, summaryScoreMode } = model
      const hit = hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)
      const source = hit?.data.sources[0]
      return source
        ? findSourceHit(source, hit.bp, hit.region.refName, summaryScoreMode)
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
      testid="wiggle-display"
      style={{ width, height }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {({ canvasRef }) => (
        <WiggleBody
          model={model}
          canvasRef={canvasRef}
          width={width}
          // Pin the right-aligned score legend to the content's right edge, not
          // the full track width (see legendRightEdgePx).
          legendWidth={legendRightEdgePx(view.visibleRegions, width)}
          height={height}
          clientMouseCoord={clientMouseCoord}
          offsetMouseCoord={offsetMouseCoord}
        />
      )}
    </DisplayChrome>
  )
})

const WiggleBody = observer(function WiggleBody({
  model,
  canvasRef,
  width,
  legendWidth,
  height,
  clientMouseCoord,
  offsetMouseCoord,
}: {
  model: WiggleDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  legendWidth: number
  height: number
  clientMouseCoord: [number, number]
  offsetMouseCoord: [number, number]
}) {
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          width,
          height: height - 2 * YSCALEBAR_LABEL_OFFSET,
          position: 'absolute',
          left: 0,
          top: YSCALEBAR_LABEL_OFFSET,
        }}
      />
      {model.isDensityMode && model.domain ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height: 16,
            width,
          }}
        >
          <ScoreLegend
            domain={model.domain}
            dataRange={model.dataRange}
            scaleType={model.scaleType}
            canvasWidth={legendWidth}
          />
        </svg>
      ) : model.ticks ? (
        <YScaleBarOverlay ticks={model.ticks} height={height} />
      ) : null}
      {model.displayCrossHatches && model.ticks ? (
        <CrossHatches ticks={model.ticks} width={width} height={height} />
      ) : null}
      {model.featureUnderMouse ? (
        <WiggleCursorLine height={height} left={offsetMouseCoord[0]} />
      ) : null}
      <WiggleTooltip model={model} clientMouseCoord={clientMouseCoord} />
    </>
  )
})

export default WiggleComponent

export type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
