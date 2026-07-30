import { useRef } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { openFeatureWidget } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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

  const dragStartXRef = useRef<number | undefined>(undefined)
  const lastDragXRef = useRef<number | undefined>(undefined)

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
    const state = model.syntenyRenderState
    if (!backend || !state) {
      return undefined
    }
    return backend.pick(coords.x, coords.y, state)
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
    if (lastDragXRef.current !== undefined) {
      dragPan(lastDragXRef.current - event.clientX)
      lastDragXRef.current = event.clientX
      return
    }
    if (scrollingRef.current) {
      return
    }
    const coords = canvasCoords(event)
    if (coords) {
      const hit = pickAt(coords)
      model.setHoveredFeature(hit)
    }
  }

  function handleMouseLeave() {
    model.setHoveredFeature(undefined)
    dragStartXRef.current = undefined
    lastDragXRef.current = undefined
  }

  function handleMouseDown(event: React.MouseEvent) {
    dragStartXRef.current = event.clientX
    lastDragXRef.current = event.clientX
  }

  function handleMouseUp(event: React.MouseEvent<HTMLCanvasElement>) {
    const start = dragStartXRef.current
    lastDragXRef.current = undefined
    dragStartXRef.current = undefined
    if (
      start === undefined ||
      Math.abs(event.clientX - start) >= CLICK_DRAG_THRESHOLD_PX
    ) {
      return
    }
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    const hit = pickAt(coords)
    model.setClickedFeature(hit)
    const display = hitDisplay(hit)
    if (display && hit) {
      openSyntenyFeatureWidget(display, hit.featureIndex)
    }
  }

  function handleContextMenu(event: React.MouseEvent<HTMLCanvasElement>) {
    event.preventDefault()
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
      <canvas
        // fresh element per re-init: neither WebGL nor Canvas2D can bind to one
        // that already held a lost context (see useRenderingBackend)
        key={canvasKey}
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        data-testid={model.settled ? 'synteny_canvas_done' : 'synteny_canvas'}
        className={classes.canvas}
        style={{ width, height }}
      />
      {combinedError ? (
        <ErrorBanner
          error={combinedError}
          onReset={gpuError ? retry : undefined}
        />
      ) : null}
    </div>
  )
})

export default LevelSyntenyCanvas
