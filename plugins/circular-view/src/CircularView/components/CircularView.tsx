import { useEffect, useRef, useState } from 'react'

import { LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Controls from './Controls.tsx'
import ImportForm from './ImportForm.tsx'
import { Rulers } from './Ruler.tsx'

import type { CircularViewModel } from '../model.ts'

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
  const { showLoading, showView, showImportForm } = model
  return showLoading ? (
    <LoadingEllipses variant="h6" message="Loading" />
  ) : showImportForm ? (
    <ImportForm model={model} />
  ) : showView ? (
    <CircularViewLoaded model={model} />
  ) : null
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
      if (distFromCenter > model.radiusPx + model.paddingPx) {
        return
      }
      event.preventDefault()
      if (event.deltaY !== 0) {
        const cursorAngle = Math.atan2(dy, dx)
        model.zoomToPoint(
          model.bpPerPx * Math.exp(event.deltaY * 0.001),
          cursorAngle,
        )
      }
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        model.rotate(event.deltaX * 0.003)
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
