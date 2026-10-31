import { Suspense, lazy, useEffect, useRef, useState } from 'react'

import { ErrorBanner, ResizeHandle, ViewLoadingScreen } from '@jbrowse/core/ui'
import { createFrameCoalescer } from '@jbrowse/core/util/frameCoalescer'
import { getEnv } from '@jbrowse/core/util/mstUtils'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { normalizeWheelDelta } from '@jbrowse/core/util/wheelZoom'
import { FloatingLegend } from '@jbrowse/display-ui'
import {
  ComparativeTooltip,
  DiagonalizeLoadingScreen,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import ChordLayer from '../../chords/ChordLayer.tsx'
import { RingAxes } from '../../rings/RingAxes.tsx'
import { RingCanvases, RingStrips } from '../../rings/RingLayer.tsx'
import { RingOverlay } from '../../rings/RingOverlay.tsx'
import { RingStatus } from '../../rings/RingStatus.tsx'
import { RingPointer } from '../../rings/ringPointer.ts'
import Controls from './Controls.tsx'
import { Rulers } from './Ruler.tsx'

import type { RingPointerEvent } from '../../rings/ringPointer.ts'
import type { CircularViewModel } from '../model.ts'

// suspends under its own boundary, since the SV inspector renders this view
// inside its own
const ImportForm = lazy(() => import('./ImportForm/index.tsx'))

// how far a press travels before it rotates rather than clicks
const DRAG_THRESHOLD_PX = 4

// a pointer's offset from the circle's middle in the screen frame
function offsetFromCenter(
  model: CircularViewModel,
  rect: DOMRect,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const [cx, cy] = model.circleCenterXY
  return [clientX - rect.left - cx, clientY - rect.top - cy] as const
}

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  panWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  circularSvg: {
    position: 'absolute',
    left: 0,
    top: 0,
    userSelect: 'none',
    overflow: 'visible',
  },
  grab: {
    cursor: 'grab',
  },
  grabbing: {
    cursor: 'grabbing',
  },
  crosshair: {
    cursor: 'crosshair',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
}))

const Slices = observer(function Slices({
  model,
}: {
  model: CircularViewModel
}) {
  return (
    <>
      <Rulers model={model} />
      <RingAxes model={model} />
      <RingOverlay model={model} />
      <RingStatus model={model} />
      {model.trackDisplays
        .filter(display => !model.isRingDisplay(display))
        .map(display => {
          // a chord display's component takes its model as `display`, not as
          // the `model` BaseDisplay's RenderingComponent names
          const { ReactComponent } = getEnv(model).pluginManager.getDisplayType(
            display.type,
          )
          return (
            <ReactComponent key={display.id} display={display} view={model} />
          )
        })}
    </>
  )
})

const BAND_TOOLTIP_ROWS = 6

function bandLines({
  name,
  shares,
}: {
  name: string
  shares: { partner: string; fraction: number }[]
}) {
  const shown = shares
    .map(s => ({ ...s, percent: Math.round(s.fraction * 100) }))
    .filter(s => s.percent > 0)
    .slice(0, BAND_TOOLTIP_ROWS)
  const rest = shares.length - shown.length
  return [
    name,
    ...shown.map(s => `${s.percent}% ${s.partner}`),
    ...(rest > 0 ? [`${rest} more`] : []),
  ]
}

const PointerTooltip = observer(function PointerTooltip({
  model,
}: {
  model: CircularViewModel
}) {
  const { hoveredChord, bandComposition, hoverClientXY } = model
  const lines = hoveredChord
    ? [hoveredChord.display.shapeLabel(hoveredChord.feature)]
    : bandComposition
      ? bandLines(bandComposition)
      : []
  return hoverClientXY && lines.length ? (
    <ComparativeTooltip
      lines={lines}
      clientPoint={{ x: hoverClientXY[0], y: hoverClientXY[1] }}
    />
  ) : null
})

const CircularView = observer(function CircularView({
  model,
}: {
  model: CircularViewModel
}) {
  const { loading, showView, showImportForm } = model
  if (model.awaitingAutoDiagonalize) {
    return (
      <DiagonalizeLoadingScreen
        status={model.diagonalizeStatus}
        onCancel={() => {
          model.cancelAutoDiagonalize()
        }}
      />
    )
  } else if (loading) {
    return <ViewLoadingScreen {...loading} />
  } else if (showImportForm) {
    return (
      <Suspense fallback={null}>
        <ImportForm model={model} />
      </Suspense>
    )
  } else if (model.error) {
    // reached only under `disableImportForm`
    return <ErrorBanner error={model.error} />
  } else if (showView) {
    return <CircularViewLoaded model={model} />
  } else {
    // no regions yet under `disableImportForm`
    return null
  }
})

const CircularViewLoaded = observer(function CircularViewLoaded({
  model,
}: {
  model: CircularViewModel
}) {
  const {
    width,
    height,
    id,
    offsetRadians,
    centerXY,
    figureSize,
    figureOriginXY,
    hideVerticalResizeHandle,
  } = model
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef(0)
  const pressRef = useRef<{ x: number; y: number } | undefined>(undefined)
  const [isDragging, setIsDragging] = useState(false)
  const ringPointerRef = useRef<RingPointer | undefined>(undefined)
  const ringPointer = (ringPointerRef.current ??= new RingPointer(
    model.ringHost,
  ))
  const draggedRef = useRef(false)

  useEffect(() => {
    return () => {
      model.setHover(undefined)
    }
  }, [model])

  // non-passive, to preventDefault; one model write per frame, and the
  // coalescer's cancel keeps a view closed mid-fling from flushing into a dead
  // node
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const frame = createFrameCoalescer()
    let rotateDelta = 0
    let zoomDelta = 0
    let anchor: readonly [number, number] = [0, 0]
    const onWheel = (event: WheelEvent) => {
      if (!frame.pending) {
        // once per frame: getBoundingClientRect forces a reflow
        anchor = offsetFromCenter(model, el.getBoundingClientRect(), event)
      }
      const [dx, dy] = anchor
      if (Math.hypot(dx, dy) > model.radiusPx + model.effectivePaddingPx) {
        return
      }
      event.preventDefault()
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      // the dominant axis only, so a swipe's noise neither zooms nor rotates
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        rotateDelta += deltaX
      } else {
        zoomDelta += deltaY
      }
      frame.schedule(() => {
        const [ax, ay] = anchor
        model.setHover(undefined)
        if (rotateDelta) {
          model.rotate(rotateDelta * 0.003)
        }
        if (zoomDelta) {
          model.zoomToPoint(model.bpPerPx * Math.exp(zoomDelta * 0.001), ax, ay)
        }
        rotateDelta = 0
        zoomDelta = 0
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      frame.cancel()
    }
  }, [model])

  const angleFromCenter = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const [dx, dy] = offsetFromCenter(model, rect, { clientX, clientY })
    return Math.atan2(dy, dx)
  }

  // primary button only, so a right-drag does not spin the figure
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return
    }
    draggedRef.current = false
    pressRef.current = { x: event.clientX, y: event.clientY }
    lastAngleRef.current = angleFromCenter(event.clientX, event.clientY)
  }

  // a ring takes the pointer first, then an ideogram band, then the chord
  // under it, which the highlight paths and the tooltip read off the model
  const routePointer = (
    event: React.MouseEvent<SVGSVGElement>,
    type: RingPointerEvent,
  ) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const [dx, dy] = offsetFromCenter(model, rect, event)
    const { clientX, clientY } = event
    const onRing = ringPointer.move(clientX, clientY, dx, dy, rect, type)
    if (onRing !== undefined) {
      model.setHover(undefined)
      return onRing
    }
    const band = model.bandAt(dx, dy)
    const hit = band === undefined ? model.chordAt(dx, dy) : undefined
    if (type === 'mousemove') {
      model.setHover(
        band !== undefined
          ? { kind: 'band', key: band }
          : hit
            ? { kind: 'chord', ...hit }
            : undefined,
        clientX,
        clientY,
      )
    } else if (type === 'click' && hit) {
      hit.display.clickFeature(hit.feature)
    }
    return undefined
  }

  const leaveFigure = () => {
    ringPointer.leave()
    model.setHover(undefined)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const press = pressRef.current
    if (!press) {
      routePointer(event, 'mousemove')
      return
    }
    // a press released off this svg never reached endDrag
    if (event.buttons === 0) {
      pressRef.current = undefined
      return
    }
    if (!isDragging) {
      if (
        Math.hypot(event.clientX - press.x, event.clientY - press.y) <
        DRAG_THRESHOLD_PX
      ) {
        return
      }
      // captured only once dragging: a capture on pointerdown retargets the
      // closing click, which the error ring's Retry under the figure needs
      event.currentTarget.setPointerCapture(event.pointerId)
      draggedRef.current = true
      leaveFigure()
      setIsDragging(true)
    }
    const angle = angleFromCenter(event.clientX, event.clientY)
    let delta = angle - lastAngleRef.current
    if (delta > Math.PI) {
      delta -= 2 * Math.PI
    } else if (delta < -Math.PI) {
      delta += 2 * Math.PI
    }
    model.rotate(delta)
    lastAngleRef.current = angle
  }

  // on pointercancel too: an interrupted touch drag fires no pointerup
  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    pressRef.current = undefined
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
  }

  return (
    <div
      ref={containerRef}
      className={classes.root}
      style={{ width, height }}
      data-testid={id}
    >
      <RingCanvases view={model} />
      <ChordLayer view={model} />
      <div
        className={classes.panWrapper}
        style={{
          transform: `translate(${figureOriginXY[0]}px,${figureOriginXY[1]}px)`,
        }}
      >
        <svg
          className={cx(
            classes.circularSvg,
            isDragging
              ? classes.grabbing
              : model.hoversChord
                ? classes.crosshair
                : classes.grab,
          )}
          style={{
            transform: `rotate(${offsetRadians}rad)`,
            transformOrigin: centerXY.map(x => `${x}px`).join(' '),
          }}
          width={figureSize}
          height={figureSize}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={leaveFigure}
          onClick={event => {
            if (!draggedRef.current) {
              routePointer(event, 'click')
            }
          }}
          onContextMenu={event => {
            if (routePointer(event, 'contextmenu') === false) {
              event.preventDefault()
            }
          }}
        >
          <g transform={`translate(${centerXY})`}>
            <Slices model={model} />
          </g>
        </svg>
      </div>
      <RingStrips host={model.ringHost} />
      <Controls model={model} />
      <PointerTooltip model={model} />
      {model.showLegend ? (
        <FloatingLegend
          sections={model.legendSpec.sections}
          maxWidth={440}
          onDismiss={() => {
            model.setShowLegend(false)
          }}
        />
      ) : null}
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          grip
          value={model.height}
          onChange={height => model.setHeight(height)}
          className={classes.resizeHandle}
        />
      )}
    </div>
  )
})

export default CircularView
