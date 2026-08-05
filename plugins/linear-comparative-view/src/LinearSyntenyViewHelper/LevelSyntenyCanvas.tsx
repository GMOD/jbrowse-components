import { useEffect, useRef } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { openFeatureWidget } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import RenderCanvas from '@jbrowse/render-core/RenderCanvas'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { SyntenyRendererFactory } from '../LinearSyntenyDisplay/SyntenyRenderer.ts'
import { useWheelScrollZoom } from './useWheelScrollZoom.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyPickResult } from '../LinearSyntenyDisplay/syntenyRenderingBackendTypes.ts'
import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'
import type React from 'react'

const useStyles = makeStyles()({
  root: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 5,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), transparent)',
      pointerEvents: 'none',
      zIndex: 10,
    },
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    imageRendering: 'auto',
    willChange: 'transform',
    contain: 'strict',
  },
})

// Distance (px) below which a mousedown/mouseup pair counts as a click, not
// a drag. Tuned to be tolerant of jittery trackpads.
const CLICK_DRAG_THRESHOLD_PX = 5

// MouseEvent.button for the left/primary button
const PRIMARY_BUTTON = 0

function openSyntenyFeatureWidget(
  display: LinearSyntenyDisplayModel,
  featureIndex: number,
) {
  const feat = display.getFeature(featureIndex)
  if (!feat) {
    return
  }
  openFeatureWidget(
    display,
    {
      uniqueId: feat.id,
      start: feat.start,
      end: feat.end,
      strand: feat.strand,
      refName: feat.refName,
      name: feat.name,
      assemblyName: feat.assemblyName,
      mate: feat.mate,
      identity: feat.identity,
    },
    {
      widget: { type: 'SyntenyFeatureWidget', id: 'syntenyFeature' },
      extra: { level: display.level },
    },
  )
}

const LevelSyntenyCanvas = observer(function LevelSyntenyCanvas({
  model,
}: {
  model: LinearSyntenyViewHelperModel
}) {
  const { classes } = useStyles()
  // the model already resolves the containing view (and narrows it to the duck),
  // so the component doesn't repeat that walk or its cast
  const { parentView } = model
  const width = parentView.width
  const height = model.height

  // In-flight drag-pan, or undefined when the pointer is not down. The gesture
  // lives on `window` rather than on the canvas (see handleMouseDown): a band is
  // ~100px tall, so a horizontal drag routinely exits through its top or bottom
  // edge, and while the listeners were on the canvas that abandoned both the pan
  // and the "was this a click?" test mid-gesture.
  const dragRef = useRef<{ startX: number; lastX: number } | undefined>(
    undefined,
  )
  const detachDragRef = useRef<(() => void) | undefined>(undefined)
  // drops the window listeners if the level unmounts mid-drag (a row removed, a
  // return to the import form), which no mouseup would otherwise arrive for
  useEffect(
    () => () => {
      detachDragRef.current?.()
    },
    [],
  )

  const {
    canvas,
    canvasRef,
    error: gpuError,
    retry,
    canvasKey,
  } = useRenderingBackend(SyntenyRendererFactory, model)

  const { scrollingRef } = useWheelScrollZoom(canvas, parentView)

  // One banner per level so GPU lifecycle errors and per-display fetch errors
  // (e.g. PAF 404) never stack visually
  const errors = [gpuError, ...model.linearSyntenyDisplays.map(d => d.error)]
    .filter(e => e != null)
    .map(e => `${e}`)
  const combinedError = errors.length > 0 ? errors.join('\n') : undefined

  function canvasCoords(evt: { clientX: number; clientY: number }) {
    const rect = canvas?.getBoundingClientRect()
    if (!rect) {
      return undefined
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
  }

  function pickAt(coords: { x: number; y: number }) {
    const backend = model.gpuRenderingBackend
    return backend
      ? backend.pick(coords.x, coords.y, model.syntenyRenderState)
      : undefined
  }

  // `displaysByKey` is a computed no reaction observes, so each access rebuilds
  // the map — resolve the hit to its display exactly once per event.
  function hitDisplay(hit: SyntenyPickResult | undefined) {
    return hit ? model.displaysByKey.get(hit.key) : undefined
  }

  // Drag-pan accumulator. Drag mode flushes synchronously per mousemove
  // because mouse events fire at ~60Hz, no batching needed.
  function dragPan(dx: number) {
    transaction(() => {
      for (const v of parentView.views) {
        v.horizontalScroll(dx)
      }
    })
  }

  function handleMouseMove(event: React.MouseEvent<HTMLCanvasElement>) {
    // the window listener owns the pointer while a drag is in flight, and
    // hovering during a pan just fights it for the main thread
    if (dragRef.current || scrollingRef.current) {
      return
    }
    const coords = canvasCoords(event)
    if (coords) {
      const hit = pickAt(coords)
      model.setHoveredFeature(hit)
    }
  }

  // Only the hover: a drag survives leaving the band, and is ended by the window
  // mouseup below wherever that lands.
  function handleMouseLeave() {
    model.setHoveredFeature(undefined)
  }

  function endDrag() {
    detachDragRef.current?.()
    detachDragRef.current = undefined
    const drag = dragRef.current
    dragRef.current = undefined
    return drag
  }

  function handleWindowMouseMove(event: MouseEvent) {
    const drag = dragRef.current
    if (drag) {
      dragPan(drag.lastX - event.clientX)
      drag.lastX = event.clientX
    }
  }

  function handleWindowMouseUp(event: MouseEvent) {
    const drag = endDrag()
    if (!drag || event.button !== PRIMARY_BUTTON) {
      return
    }
    if (Math.abs(event.clientX - drag.startX) >= CLICK_DRAG_THRESHOLD_PX) {
      return
    }
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    // A release outside the band answers no hit (the pick engine rejects a y
    // outside the track), which clears the selection — the same thing a click on
    // empty canvas has always done.
    const hit = pickAt(coords)
    model.setClickedFeature(hit)
    const display = hitDisplay(hit)
    if (display && hit) {
      openSyntenyFeatureWidget(display, hit.featureIndex)
    }
  }

  function handleMouseDown(event: React.MouseEvent) {
    // Primary button only. A right-click is mousedown -> contextmenu -> mouseup
    // at the same position, so arming the drag on it made the mouseup read as a
    // click and open the feature widget behind the context menu.
    if (event.button !== PRIMARY_BUTTON) {
      return
    }
    dragRef.current = { startX: event.clientX, lastX: event.clientX }
    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    detachDragRef.current = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }

  function handleContextMenu(event: React.MouseEvent<HTMLCanvasElement>) {
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    const hit = pickAt(coords)
    if (!hit) {
      return
    }
    const display = hitDisplay(hit)
    const feat = display?.getFeature(hit.featureIndex)
    if (display && feat) {
      // preventDefault only when a menu actually opens, so a right-click on
      // empty canvas between the ribbons falls through to the browser instead
      // of being a dead zone — same rule every other display's handler follows.
      event.preventDefault()
      // clear the hover tooltip so it doesn't stay stuck behind the menu
      model.setHoveredFeature(undefined)
      display.openContextMenu({
        clientX: event.clientX,
        clientY: event.clientY,
        feature: feat,
      })
    }
  }

  return (
    <div className={classes.root} style={{ width, height }}>
      <RenderCanvas
        handle={{ canvasRef, canvasKey }}
        drawn={model.settled}
        data-testid={model.settled ? 'synteny_canvas_done' : 'synteny_canvas'}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        className={classes.canvas}
        style={{ width, height }}
      />
      {combinedError ? (
        // One banner stacks the GPU error and every display's fetch error, so
        // Retry has to undo whichever are present: `retry()` re-inits the
        // backend, `reload()` refires each display's fetch autorun. It used to
        // pass `retry` alone, so a PAF 404 with no GPU error rendered a banner
        // with no button and the only way out was reloading the tab.
        <ErrorBanner
          error={combinedError}
          onReset={() => {
            if (gpuError) {
              retry()
            }
            for (const d of model.linearSyntenyDisplays) {
              if (d.error) {
                d.reload()
              }
            }
          }}
        />
      ) : null}
    </div>
  )
})

export default LevelSyntenyCanvas
