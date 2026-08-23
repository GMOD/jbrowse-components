import { Suspense, lazy, useEffect, useRef, useState } from 'react'

import { ErrorBanner, ResizeHandle, ViewLoadingScreen } from '@jbrowse/core/ui'
import { createFrameCoalescer } from '@jbrowse/core/util/frameCoalescer'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ZOOM_ACTIVE_WINDOW_MS,
  normalizeWheelDelta,
} from '@jbrowse/core/util/wheelZoom'
import { observer } from 'mobx-react'

import Controls from './Controls.tsx'
import { Rulers } from './Ruler.tsx'

import type { CircularViewModel } from '../model.ts'

// lazies. Local Suspense at the use site rather than relying on the app's
// ViewWrapper boundary: the sv-inspector renders this component directly inside
// its own view, so suspending here would blank the whole SV inspector.
const ImportForm = lazy(() => import('./ImportForm.tsx'))

// How far a press has to travel before it rotates the figure rather than
// clicking what is under it. See handlePointerMove.
const DRAG_THRESHOLD_PX = 4

// where a pointer sits relative to the middle of the circle, in the *screen*
// frame — the figure's own rotation is left in, since both callers want it
// there (the rotation delta is a difference of two of these, and the pan
// zoomToPoint applies is screen-space)
function offsetFromCenter(
  model: CircularViewModel,
  rect: DOMRect,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const [originX, originY] = model.figureOriginXY
  const [cx, cy] = model.centerXY
  return [
    clientX - rect.left - originX - cx,
    clientY - rect.top - originY - cy,
  ] as const
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
  },
  grab: {
    cursor: 'grab',
  },
  grabbing: {
    cursor: 'grabbing',
  },
  // Opt-IN, so that a gesture merely leaves it off. The 0.5s smooths the two
  // discrete rotations — the rotate buttons' pi/6 steps and resetView's snap
  // back to the default angle. Continuous input must not have it: a fresh 0.5s
  // ease starting every frame gets ~3% of the way before the next one replaces
  // it, so the figure crawls far behind the fingers and then coasts on after
  // they stop. The drag turned it off for exactly that reason; the wheel
  // rotation, which is the same continuous input off a different device, was
  // left dragging the ease behind it.
  settled: {
    transition: 'transform 0.5s',
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
      {model.tracks.map(track => {
        const display = track.displays[0]
        return (
          <display.RenderingComponent
            key={display.id}
            display={display}
            view={model}
          />
        )
      })}
    </>
  )
})

const CircularView = observer(function CircularView({
  model,
}: {
  model: CircularViewModel
}) {
  const { showLoading, showView, showImportForm, loadingMessage } = model
  if (showLoading) {
    return (
      <ViewLoadingScreen
        message={loadingMessage}
        fraction={model.loadingProgress}
        source={model.loadingSource}
      />
    )
  } else if (showImportForm) {
    return (
      <Suspense fallback={null}>
        <ImportForm model={model} />
      </Suspense>
    )
  } else if (model.error) {
    // Only reachable with `disableImportForm`, which suppresses the form this
    // view normally reports errors inside. Before showView deliberately: an
    // error means the regions on the circle can't be trusted, and the form
    // branch above wins over the figure for the same reason when it is enabled.
    return <ErrorBanner error={model.error} />
  } else if (showView) {
    return <CircularViewLoaded model={model} />
  } else {
    // The one view whose last branch isn't its content: `disableImportForm`
    // (the sv-inspector's embedded circle) suppresses the form, so a circle
    // with no regions yet has nothing to draw and nothing to offer. Every other
    // view reaches its content here.
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
  // where the press started, until it either travels far enough to become a
  // rotation (see handlePointerMove) or ends as the click it looked like
  const pressRef = useRef<{ x: number; y: number } | undefined>(undefined)
  const [isDragging, setIsDragging] = useState(false)
  // a wheel gesture has no up event to end it, so it ends by going quiet — the
  // same window `wheelZoom` treats a view as actively zooming for
  const [isWheeling, setIsWheeling] = useState(false)

  // Non-passive wheel listener so we can call preventDefault(). The handler only
  // accumulates: one model write per animation frame, not per event. A trackpad
  // burst is dozens of events between paints, and each write re-lays every slice
  // and redraws every chord — a whole-genome callset is tens of thousands of
  // them. `createFrameCoalescer` also owns the cancel, without which a view
  // closed mid-fling flushes into a destroyed MST node.
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const frame = createFrameCoalescer()
    let rotateDelta = 0
    let zoomDelta = 0
    let settle: ReturnType<typeof setTimeout> | undefined
    let anchor: readonly [number, number] = [0, 0]
    const onWheel = (event: WheelEvent) => {
      if (!frame.pending) {
        // measured once per frame, behind the pending check:
        // getBoundingClientRect forces a synchronous reflow, and a burst
        // reaching it per event is what trips "[Violation] 'wheel' handler took
        // Nms"
        anchor = offsetFromCenter(model, el.getBoundingClientRect(), event)
      }
      const [dx, dy] = anchor
      if (Math.hypot(dx, dy) > model.radiusPx + model.effectivePaddingPx) {
        return
      }
      event.preventDefault()
      setIsWheeling(true)
      clearTimeout(settle)
      settle = setTimeout(() => {
        setIsWheeling(false)
      }, ZOOM_ACTIVE_WINDOW_MS)
      // `deltaX`/`deltaY` are only pixels when `deltaMode` says so. Firefox
      // reports whole lines for a mouse wheel — `deltaMode: 1`, `deltaY: ±3` —
      // where Chrome reports `deltaMode: 0`, `deltaY: ±100`, so the raw number
      // zoomed 0.3% of a notch there against Chrome's 10%
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      // whichever axis dominates, and only that one. A trackpad's horizontal
      // swipe carries a little vertical noise (and vice versa), so running both
      // arms meant every rotation gesture also crept the zoom
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        rotateDelta += deltaX
      } else {
        zoomDelta += deltaY
      }
      frame.schedule(() => {
        const [ax, ay] = anchor
        if (rotateDelta) {
          model.rotate(rotateDelta * 0.003)
        }
        if (zoomDelta) {
          // exp is multiplicative, so a frame's deltas summed zoom by exactly
          // what applying each in turn would have
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
      clearTimeout(settle)
    }
  }, [model])

  const angleFromCenter = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const [dx, dy] = offsetFromCenter(model, rect, { clientX, clientY })
    return Math.atan2(dy, dx)
  }

  // primary button only: a right-press latched a press the move handler's
  // `buttons === 0` check waves through, so a right-drag spun the figure under
  // the context menu it also opened
  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return
    }
    pressRef.current = { x: event.clientX, y: event.clientY }
    lastAngleRef.current = angleFromCenter(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const press = pressRef.current
    if (!press) {
      return
    }
    // A press under the drag threshold never captures the pointer (see below),
    // so if it is released anywhere but on this <svg> — the controls overlay
    // that sits on top of the figure, the resize handle, outside the window —
    // no pointerup reaches endDrag and the press stays latched. The next plain
    // hover over the figure would then pass the threshold and rotate it with no
    // button held down.
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
      // Only now take the pointer, so the rotation keeps following a cursor
      // that leaves the figure. Capturing on pointerdown instead retargets the
      // whole gesture at this <svg> — including the click that ends it — and
      // the chords underneath, which carry their own onClick, would never see
      // one. A press that doesn't move never captures, and stays a click.
      event.currentTarget.setPointerCapture(event.pointerId)
      setIsDragging(true)
    }
    const angle = angleFromCenter(event.clientX, event.clientY)
    let delta = angle - lastAngleRef.current
    // wrap delta to [-π, π] to handle the ±π boundary crossing
    if (delta > Math.PI) {
      delta -= 2 * Math.PI
    } else if (delta < -Math.PI) {
      delta += 2 * Math.PI
    }
    model.rotate(delta)
    lastAngleRef.current = angle
  }

  // pointercancel as well as pointerup: a touch drag the browser interrupts
  // never fires `up`, and the rotation would stay latched to the cursor
  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    pressRef.current = undefined
    // release only what the move handler took — a press that stayed under the
    // threshold never captured anything
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
      <div
        className={classes.panWrapper}
        style={{
          transform: `translate(${figureOriginXY[0]}px,${figureOriginXY[1]}px)`,
        }}
      >
        <svg
          className={cx(
            classes.circularSvg,
            isDragging ? classes.grabbing : classes.grab,
            isDragging || isWheeling ? undefined : classes.settled,
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
        >
          <g transform={`translate(${centerXY})`}>
            <Slices model={model} />
          </g>
        </svg>
      </div>
      <Controls model={model} />
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          bar
          onDrag={distance => model.resizeHeight(distance)}
          className={classes.resizeHandle}
        />
      )}
    </div>
  )
})

export default CircularView
