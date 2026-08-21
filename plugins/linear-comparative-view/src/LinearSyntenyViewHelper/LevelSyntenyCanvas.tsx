import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import { ErrorBanner, GpuFallbackButton } from '@jbrowse/core/ui'
import { getSession, openFeatureWidget } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useScrollZoomHintState } from '@jbrowse/core/util/usePanZoom'
import RenderCanvas from '@jbrowse/render-core/RenderCanvas'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { SyntenyRendererFactory } from '../LinearSyntenyDisplay/SyntenyRenderer.ts'
import { syntenyWidgetFeature } from '../LinearSyntenyDisplay/syntenyWidgetFeature.ts'
import OffscreenMateOverlay from './OffscreenMateOverlay.tsx'
import OffscreenMateTooltip from './OffscreenMateTooltip.tsx'
import { offscreenMateHit, offscreenMateNavHit } from './offscreenMateStrip.ts'
import { useWheelScrollZoom } from './useWheelScrollZoom.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { OffscreenMateHover } from './OffscreenMateTooltip.tsx'
import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'
import type React from 'react'

const ScrollZoomHint = lazy(() => import('@jbrowse/core/ui/ScrollZoomHint'))

// The band's prompt carries a button, so it has to outlast the trip from "I
// read it" to "my cursor is on it" — same reason the genome view passes this.
const HINT_LINGER_MS = 5000

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

// Distance (px) a press has to travel before it is a pan rather than a click.
// Tuned to be tolerant of jittery trackpads.
const CLICK_DRAG_THRESHOLD_PX = 5

// MouseEvent.button for the left/primary button
const PRIMARY_BUTTON = 0

interface CanvasPoint {
  x: number
  y: number
  clientX: number
  clientY: number
}

function openSyntenyFeatureWidget(
  display: LinearSyntenyDisplayModel,
  instanceIndex: number,
) {
  const feat = display.getFeature(instanceIndex)
  if (!feat) {
    return
  }
  openFeatureWidget(display, syntenyWidgetFeature(feat), {
    widget: { type: 'SyntenyFeatureWidget', id: 'syntenyFeature' },
    extra: { level: display.level },
  })
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

  // In-flight drag-pan, or undefined when the pointer is not down. `panned`
  // LATCHES the first time the press travels past the threshold and never
  // clears, which is what makes the release's verdict independent of where the
  // pointer ended up: this used to compare the release position against the
  // start, so a pan out and back read as a click and opened the feature widget.
  // Same shape as the genome view's own `usePanZoom`.
  const dragRef = useRef<
    { startX: number; lastX: number; panned: boolean } | undefined
  >(undefined)
  // The contig under the pointer's mark and the pointer that found it, or
  // undefined. Local rather than on the model beside `hoveredFeature`: nothing
  // outside this canvas reads it, and a mark is not a feature — putting it there
  // would mean every consumer of the hovered feature learning to expect
  // something with no feature id.
  const [hoveredContig, setHoveredContig] = useState<
    (OffscreenMateHover & { bandTransformKey: string }) | undefined
  >(undefined)
  // The other axis of a stored hover's invalidation: the band moving under a
  // stationary cursor, which fires no pointer event — a wheel-zoom, or the pan
  // half of a drag. The level's own hover has `installClearHoverOnBandMove` for
  // this; the contig is local state, so without it the tooltip goes on naming
  // the contig the cursor used to be over.
  //
  // STAMPED AND COMPARED, not cleared by an effect. The hover is only ever
  // valid for the transform it was picked under, so that is a property OF the
  // stored value rather than a second piece of state to keep in step with it —
  // an effect would render the stale name once and take it back on the commit
  // after, which is the "you might not need an effect" case exactly.
  const { bandTransformKey } = model
  const hover =
    hoveredContig?.bandTransformKey === bandTransformKey
      ? hoveredContig
      : undefined
  // Coalesces hover picks to one per frame. A pick is under 0.1ms on collinear
  // data but ~12.5ms on an all-vs-all PAF (SYNTENY_PICKING.md), where a mouse
  // reporting faster than the display would otherwise queue a pick per event
  // and spend the whole frame budget on hovers nothing draws.
  const hoverRef = useRef<
    { frame: number; at: CanvasPoint | undefined } | undefined
  >(undefined)
  const cancelHover = useCallback(() => {
    if (hoverRef.current) {
      cancelAnimationFrame(hoverRef.current.frame)
      hoverRef.current = undefined
    }
  }, [])
  // a level can unmount mid-gesture (a row removed, a return to the import
  // form); pointer capture releases itself, the pending frame does not
  useEffect(() => cancelHover, [cancelHover])

  const {
    canvas,
    canvasRef,
    error: gpuError,
    retry,
    canvasKey,
  } = useRenderingBackend(SyntenyRendererFactory, model)

  // The prompt for a wheel the band ate and did nothing with — see
  // useWheelScrollZoom, where that is a guaranteed outcome rather than a
  // conditional one. Same session-wide pacing the genome views keep, so a
  // synteny view's three wheel surfaces can't interrupt three times over.
  const session = getSession(model)
  const {
    showZoomHint,
    zoomHintAt,
    zoomHintMounted,
    dismissZoomHint,
    setZoomHintHeld,
    noteDeadWheel,
  } = useScrollZoomHintState({
    lingerMs: HINT_LINGER_MS,
    enabled: session.canShowScrollZoomHint,
    onShow: () => {
      session.noteScrollZoomHintShown()
    },
    // they replied, so the next raise is the long way off rather than the
    // backoff's next step
    onAnswered: () => {
      session.snoozeScrollZoomHints()
    },
  })
  const { scrollingRef } = useWheelScrollZoom(canvas, parentView, noteDeadWheel)

  // One banner per level so GPU lifecycle errors and per-display fetch errors
  // (e.g. PAF 404) never stack visually. The fetch half is the level's own
  // `displayError` — an on-screen affordance only: the SVG export reads each
  // display's `error` for itself, since a figure has no banner to float and
  // fails outright instead.
  const errors = [gpuError, model.displayError].filter(e => e != null)
  const combinedError = errors.length > 0 ? errors.join('\n') : undefined

  // The pointer in canvas coordinates, with the client point it came from: a
  // tooltip is positioned against the viewport, so dropping it here would mean
  // recovering it from the canvas rect a second time.
  function canvasCoords(evt: {
    clientX: number
    clientY: number
  }): CanvasPoint | undefined {
    const rect = canvas?.getBoundingClientRect()
    if (!rect) {
      return undefined
    }
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      clientX: evt.clientX,
      clientY: evt.clientY,
    }
  }

  function pickAt(coords: { x: number; y: number }) {
    const backend = model.gpuRenderingBackend
    return backend
      ? backend.pick(coords.x, coords.y, model.syntenyRenderState)
      : undefined
  }

  // Drag-pan accumulator. Drag mode flushes synchronously per event because
  // pointer moves already arrive at about frame rate, no batching needed.
  function dragPan(dx: number) {
    transaction(() => {
      for (const v of parentView.views) {
        v.horizontalScroll(dx)
      }
    })
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (drag) {
      const dx = drag.lastX - event.clientX
      drag.lastX = event.clientX
      drag.panned ||=
        Math.abs(event.clientX - drag.startX) >= CLICK_DRAG_THRESHOLD_PX
      dragPan(dx)
      return
    }
    // hovering under a wheel-zoom fights the gesture for the main thread, and
    // the viewport-change reaction on the level has already dropped the hover
    if (scrollingRef.current) {
      return
    }
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    if (hoverRef.current) {
      hoverRef.current.at = coords
      return
    }
    hoverRef.current = {
      at: coords,
      frame: requestAnimationFrame(() => {
        const at = hoverRef.current?.at
        hoverRef.current = undefined
        if (at) {
          const mate = offscreenMateHit(model, at.x, at.y)
          setHoveredContig(
            mate && {
              refName: mate.refName,
              side: mate.side,
              clientX: at.clientX,
              clientY: at.clientY,
              bandTransformKey: model.bandTransformKey,
            },
          )
          // a mark hovered is not a ribbon hovered, and leaving the old one lit
          // says the pointer is somewhere it is not
          model.setHoveredFeature(mate ? undefined : pickAt(at))
        }
      }),
    }
  }

  // Only the hover: a drag survives leaving the band (pointer capture follows it
  // out), and ends at whatever pointerup it gets.
  function handlePointerLeave() {
    cancelHover()
    setHoveredContig(undefined)
    model.setHoveredFeature(undefined)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    // Primary button only. A right-click is pointerdown -> contextmenu ->
    // pointerup at the same position, so arming the drag on it made the release
    // read as a click and open the feature widget behind the context menu.
    if (event.button !== PRIMARY_BUTTON) {
      return
    }
    // A band is ~100px tall, so a horizontal drag routinely leaves through its
    // top or bottom edge. Capture keeps the rest of the gesture addressed here,
    // which is what a pair of window listeners used to buy — and unlike them it
    // needs no unmount cleanup, since the browser releases it with the element.
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      lastX: event.clientX,
      panned: false,
    }
    cancelHover()
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    dragRef.current = undefined
    if (!drag || event.button !== PRIMARY_BUTTON) {
      return
    }
    if (drag.panned) {
      return
    }
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    // The mark strip first, in the few pixels above every ribbon. A mark is not
    // a feature — it stands for alignments this level cannot draw at all — so it
    // answers with a navigation rather than a selection, and must not fall
    // through to clear the clicked feature on its way.
    const mate = offscreenMateNavHit(model, coords.x, coords.y)
    if (mate) {
      model.showOffscreenMateContig(mate.refName, mate.navRow, {
        start: mate.start,
        end: mate.end,
      })
      return
    }
    // A release outside the band answers no hit (the pick engine rejects a y
    // outside the track), which clears the selection — the same thing a click on
    // empty canvas has always done.
    const hit = pickAt(coords)
    const display = model.setClickedFeature(hit)
    if (display && hit) {
      openSyntenyFeatureWidget(display, hit.instanceIndex)
    }
  }

  // The browser can take the pointer over mid-gesture (a touch that becomes a
  // page scroll, a system gesture) and then no pointerup arrives, so without
  // this the drag anchor outlives it and every later move still pans.
  function handlePointerCancel() {
    dragRef.current = undefined
  }

  function handleContextMenu(event: React.MouseEvent<HTMLCanvasElement>) {
    const coords = canvasCoords(event)
    if (!coords) {
      return
    }
    // The mark strip first, as in the move and release handlers. The strip is
    // NOT clear of the ribbons — the pick engine accepts any y inside the
    // track height — so without this a right-click on a mark opened the menu
    // for whatever ribbon happened to run beneath it, and outlined it too.
    if (offscreenMateHit(model, coords.x, coords.y)) {
      return
    }
    const hit = pickAt(coords)
    if (!hit) {
      return
    }
    const display = model.displayFor(hit.key)
    const feat = display?.getFeature(hit.instanceIndex)
    if (display && feat) {
      // preventDefault only when a menu actually opens, so a right-click on
      // empty canvas between the ribbons falls through to the browser instead
      // of being a dead zone — same rule every other display's handler follows.
      event.preventDefault()
      // clear the hover tooltip so it doesn't stay stuck behind the menu
      model.setHoveredFeature(undefined)
      // ...and outline the ribbon the menu is about, which is what the tooltip
      // was doing until the line above. Without it the menu names no ribbon at
      // all: the picture a synteny view usually shows is a hairball of
      // overlapping bands, the pick engine resolved exactly one of them, and
      // "Move bottom panel to the matching region" gives the user no way to see
      // which. Same fix, same reason, as the alignments display re-boxing the
      // read under its own context menu.
      model.setClickedFeature(hit)
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
        phase={model.displayPhase}
        data-testid="synteny_canvas"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        className={classes.canvas}
        style={{
          width,
          height,
          cursor: model.hoveringFeature || hover ? 'pointer' : 'default',
        }}
      />
      <OffscreenMateOverlay model={model} />
      {hover ? <OffscreenMateTooltip model={model} hover={hover} /> : null}
      {combinedError ? (
        // One banner stacks the GPU error and every display's fetch error, so
        // Retry has to undo whichever are present: `retry()` re-inits the
        // backend, `reload()` refires each display's fetch autorun. It used to
        // pass `retry` alone, so a PAF 404 with no GPU error rendered a banner
        // with no button and the only way out was reloading the tab.
        <ErrorBanner
          error={combinedError}
          // gated on `gpuError`, NOT `combinedError` — the latter is a joined
          // string (see above), and the lost-context flag lives on the error
          // object, so the predicate would answer false for every real context
          // loss and the button would never appear. Retry is `retry` alone
          // here: switching backend fixes the GPU half, and a display's fetch
          // error is not its to clear.
          extraAction={<GpuFallbackButton error={gpuError} onRetry={retry} />}
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
      {/* portals itself to the body and positions in viewport coordinates —
      the band is a few dozen pixels tall, so nothing drawn inside it could be
      read anyway */}
      {zoomHintMounted ? (
        <Suspense fallback={null}>
          <ScrollZoomHint
            show={showZoomHint}
            at={zoomHintAt}
            onEnable={() => {
              session.setScrollZoom(true)
              dismissZoomHint()
            }}
            onHeldChange={setZoomHintHeld}
          />
        </Suspense>
      ) : null}
    </div>
  )
})

export default LevelSyntenyCanvas
