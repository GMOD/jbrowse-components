import { Suspense, lazy, useEffect, useRef, useState } from 'react'

import { ErrorBanner, ResizeHandle, ViewLoadingScreen } from '@jbrowse/core/ui'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
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
  idle: {
    cursor: 'grab',
    transition: 'transform 0.5s',
  },
  dragging: {
    cursor: 'grabbing',
    transition: 'none',
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

  // non-passive wheel listener so we can call preventDefault()
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      const rect = el.getBoundingClientRect()
      const [dx, dy] = offsetFromCenter(model, rect, event)
      const distFromCenter = Math.hypot(dx, dy)
      if (distFromCenter > model.radiusPx + model.effectivePaddingPx) {
        return
      }
      event.preventDefault()
      // whichever axis dominates, and only that one. A trackpad's horizontal
      // swipe carries a little vertical noise (and vice versa), so running both
      // arms meant every rotation gesture also crept the zoom
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        model.rotate(event.deltaX * 0.003)
      } else if (event.deltaY !== 0) {
        model.zoomToPoint(
          model.bpPerPx * Math.exp(event.deltaY * 0.001),
          dx,
          dy,
        )
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [model])

  const angleFromCenter = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const [dx, dy] = offsetFromCenter(model, rect, { clientX, clientY })
    return Math.atan2(dy, dx)
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
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
            isDragging ? classes.dragging : classes.idle,
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
