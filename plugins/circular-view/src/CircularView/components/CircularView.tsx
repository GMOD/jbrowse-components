import { useEffect, useRef, useState } from 'react'

import { LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Controls from './Controls.tsx'
import ImportForm from './ImportForm.tsx'
import Ruler from './Ruler.tsx'

import type { CircularViewModel } from '../model.ts'

const dragHandleHeight = 3

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
    height: dragHandleHeight,
    position: 'absolute',
    bottom: 0,
    left: 0,
    background: '#ccc',
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
}))

const Slices = observer(function Slices({
  model,
}: {
  model: CircularViewModel
}) {
  return (
    <>
      {model.staticSlices.map(slice => (
        <Ruler key={slice.key} model={model} slice={slice} />
      ))}
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
    hideVerticalResizeHandle,
    panX,
    panY,
  } = model
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const lastAngleRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  // non-passive wheel listener so we can call preventDefault()
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      const rect = el.getBoundingClientRect()
      const [cx, cy] = model.centerXY
      const dx = event.clientX - rect.left - cx - model.panX
      const dy = event.clientY - rect.top - cy - model.panY
      const distFromCenter = Math.sqrt(dx * dx + dy * dy)
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
    const [cx, cy] = centerXY
    return Math.atan2(
      clientY - rect.top - cy - panY,
      clientX - rect.left - cx - panX,
    )
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    lastAngleRef.current = angleFromCenter(event.clientX, event.clientY)
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
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
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
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
        style={{ transform: `translate(${panX}px,${panY}px)` }}
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
          onPointerUp={handlePointerUp}
        >
          <g transform={`translate(${centerXY})`}>
            <Slices model={model} />
          </g>
        </svg>
      </div>
      <Controls model={model} />
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          onDrag={distance => model.resizeHeight(distance)}
          className={classes.resizeHandle}
        />
      )}
    </div>
  )
})

export default CircularView
