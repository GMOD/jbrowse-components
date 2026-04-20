import { useEffect, useRef, useState } from 'react'

import { LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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
}))

const Slices = observer(function Slices({
  model,
}: {
  model: CircularViewModel
}) {
  return (
    <>
      {model.staticSlices.map(slice => (
        <Ruler
          key={assembleLocString(
            slice.region.elided ? slice.region.regions[0]! : slice.region,
          )}
          model={model}
          slice={slice}
        />
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
  const { showLoading, showView, showImportForm, loadingMessage } = model

  if (showLoading) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (showImportForm) {
    return <ImportForm model={model} />
  } else if (showView) {
    return <CircularViewLoaded model={model} />
  } else {
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
    figureWidth,
    figureHeight,
    hideVerticalResizeHandle,
  } = model
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  // ref tracks drag imperatively to avoid closure-capture timing issues
  const dragRef = useRef({ dragging: false, lastAngle: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // non-passive wheel listener so we can call preventDefault()
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      // Snap the cursor to the ring: project it onto the circumference at the
      // same angle. Only intercept if the cursor is within the figure area
      // (i.e. close enough to the circle to be intentional).
      const rect = el.getBoundingClientRect()
      const [cx, cy] = model.centerXY
      const dx = event.clientX - rect.left - cx
      const dy = event.clientY - rect.top - cy
      const distFromCenter = Math.sqrt(dx * dx + dy * dy)
      // ignore if cursor is outside the padded figure entirely
      if (distFromCenter > model.radiusPx + model.paddingPx) {
        return
      }
      event.preventDefault()
      // vertical scroll → zoom; horizontal scroll → rotate
      if (event.deltaY !== 0) {
        model.setBpPerPx(model.bpPerPx * Math.exp(event.deltaY * 0.001))
      }
      // only rotate when scroll is predominantly horizontal, to avoid accidental
      // rotation bleeding in from vertical trackpad scrolls
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
    return Math.atan2(clientY - rect.top - cy, clientX - rect.left - cx)
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current.dragging = true
    dragRef.current.lastAngle = angleFromCenter(event.clientX, event.clientY)
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.dragging) {
      return
    }
    const angle = angleFromCenter(event.clientX, event.clientY)
    let delta = angle - dragRef.current.lastAngle
    // wrap delta to [-π, π] to handle the ±π boundary crossing
    if (delta > Math.PI) {
      delta -= 2 * Math.PI
    } else if (delta < -Math.PI) {
      delta += 2 * Math.PI
    }
    model.rotate(delta)
    dragRef.current.lastAngle = angle
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current.dragging = false
    setIsDragging(false)
  }

  return (
    <div
      ref={containerRef}
      className={classes.root}
      style={{ width, height }}
      data-testid={id}
    >
      <svg
        style={{
          transform: `rotate(${offsetRadians}rad)`,
          transition: isDragging ? 'none' : 'transform 0.5s',
          transformOrigin: centerXY.map(x => `${x}px`).join(' '),
          position: 'absolute',
          left: 0,
          top: 0,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        width={figureWidth}
        height={figureHeight}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <g transform={`translate(${centerXY})`}>
          <Slices model={model} />
        </g>
      </svg>
      <Controls model={model} />
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          onDrag={model.resizeHeight}
          style={{
            height: dragHandleHeight,
            position: 'absolute',
            bottom: 0,
            left: 0,
            background: '#ccc',
            boxSizing: 'border-box',
            borderTop: '1px solid #fafafa',
          }}
        />
      )}
    </div>
  )
})

export default CircularView
