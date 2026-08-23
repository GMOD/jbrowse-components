import { useCallback } from 'react'

import { Crosshairs, useMouseState } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import {
  CrossHatches,
  ScoreRules,
  YScaleBarOverlay,
} from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import ScoreLegend, { scoreLegendHeight } from '../../shared/ScoreLegend.tsx'
import { WiggleRenderer } from '../../shared/WiggleRenderer.ts'
import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { legendRightEdgePx } from '../../shared/wiggleComponentUtils.ts'
import { findSourceHit, hitTestMouse } from '../../shared/wiggleHitTest.ts'
import { wiggleMouseHandlers } from '../../shared/wiggleMouseHandlers.ts'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
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
  const width = model.canvasWidthPx
  const height = model.height

  const computeHit = useCallback(
    (offsetX: number) => {
      const { rpcDataMap, effectiveSummaryScoreMode } = model
      const hit = hitTestMouse(view.visibleRegions, rpcDataMap, offsetX)
      const source = hit?.data.sources[0]
      return source
        ? findSourceHit(
            source,
            hit.bp,
            hit.region.refName,
            effectiveSummaryScoreMode,
          )
        : undefined
    },
    [model, view],
  )

  const { onPointerPosition, onClick } = wiggleMouseHandlers(model, computeHit)

  return (
    <DisplayChrome
      model={model}
      factory={WiggleRenderer}
      testid="wiggle-display"
      // whiteSpace/textAlign were inherited from `DisplayContainer` until it was
      // deleted; kept verbatim so the legend and y-axis labels lay out the same
      style={{ width, height, whiteSpace: 'nowrap', textAlign: 'left' }}
      onPointerPosition={onPointerPosition}
      onClick={onClick}
    >
      {({ canvasRef, mouseTracker }) => (
        <WiggleBody
          model={model}
          canvasRef={canvasRef}
          width={width}
          height={height}
          mouseTracker={mouseTracker}
        />
      )}
    </DisplayChrome>
  )
})

const WiggleBody = observer(function WiggleBody({
  model,
  canvasRef,
  width,
  height,
  mouseTracker,
}: {
  model: WiggleDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  height: number
  mouseTracker: MouseTracker
}) {
  // read here rather than beside the handlers, so a mousemove re-renders this
  // body instead of the whole DisplayChrome above it
  const mouseState = useMouseState(mouseTracker)
  const { yTop, plotHeight } = model.plotGeometry
  // Pin the right-aligned score legend to the content's right edge, not the
  // full track width (see legendRightEdgePx). Read HERE, in the body, and not
  // where the chrome is mounted — `visibleRegions` rebuilds its array on every
  // pan frame, so a read up there re-rendered `DisplayChrome` itself (and with
  // it `useRenderingBackend`, the status container's fresh inline style and the
  // overlay portal) for the whole of every drag. Multi-wiggle already reads it
  // in its body for this reason; this was the last copy that didn't.
  const view = getContainingView(model) as LGV
  const legendWidth = legendRightEdgePx(view.visibleRegions, width)
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          width,
          // the box `model.ticks` places itself in, so a tick lands on its data
          height: plotHeight,
          position: 'absolute',
          left: 0,
          top: yTop,
        }}
      />
      {model.isDensityMode && model.domain ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            // an <svg> clips to its own box, so it has to be as tall as the
            // legend the ramp/text choice produces
            height: scoreLegendHeight(model.scoreRamp),
            width,
          }}
        >
          <ScoreLegend
            domain={model.domain}
            scaleType={model.scaleType}
            canvasWidth={legendWidth}
            ramp={model.scoreRamp}
          />
        </svg>
      ) : model.ticks ? (
        <YScaleBarOverlay ticks={model.ticks} height={height} width={width} />
      ) : null}
      {model.showCrossHatches && model.ticks ? (
        <CrossHatches ticks={model.ticks} width={width} height={height} />
      ) : null}
      {model.scoreRuleMarks.length > 0 ? (
        <ScoreRules
          marks={model.scoreRuleMarks}
          width={width}
          height={height}
        />
      ) : null}
      {/* no mouseY, so no horizontal guide: y here is the score axis, which
          CrossHatches above already rules, and a second line at the cursor would
          read as another threshold */}
      {model.hoveredFeature && mouseState ? (
        <Crosshairs mouseX={mouseState.x} width={width} height={height} />
      ) : null}
      <WiggleTooltip model={model} mouseState={mouseState} />
    </>
  )
})

export default WiggleComponent

export type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
