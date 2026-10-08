import { Fragment, useEffect, useState } from 'react'

// deep subpath, never the `@jbrowse/core/ui` barrel: this file is the
// toolkit-free half of the chrome and the barrel pulls in MUI
import {
  ClearTrackedPointerProvider,
  useMouseTracking,
} from '@jbrowse/core/ui/useMouseTracking'
import {
  BottomRightCornerContext,
  TrackOverlayPortal,
} from '@jbrowse/display-ui'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import ChromeHighlight from './ChromeHighlight.tsx'
import ChromeLegend from './ChromeLegend.tsx'
import ChromeYAxis from './ChromeYAxis.tsx'
import ReplacedDisplay from './ReplacedDisplay.tsx'
import { isAxisHost } from './axisHost.ts'
import { isHighlightHost } from './highlightHost.ts'
import { isLegendHost } from './legendHost.ts'
import { useAnimationFrames } from './useAnimationFrames.ts'

import type { DisplayBackgroundProgressModel } from './DisplayBackgroundProgress.tsx'
import type { DisplayErrorBarModel } from './DisplayErrorBar.tsx'
import type { DisplayLoadingOverlayModel } from './DisplayLoadingOverlay.tsx'
import type { TooLargeMessageModel } from './TooLargeMessage.tsx'
import type { AnimationHost } from './useAnimationFrames.ts'
import type {
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui/useMouseTracking'
import type { DisplayChromeOverlays } from '@jbrowse/display-ui'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ComponentPropsWithRef, MouseEventHandler, ReactNode } from 'react'

// What the chrome reads itself, plus what each overlay reads, composed from the
// overlays' own model types so the two cannot drift. `renderError` and
// `setRenderError` are `RenderLifecycleModel`'s, intersected in below.
export type ChromeModel = {
  displayPhase: DisplayPhase
  // `painted`, never the raw `canvasDrawn`: a display showing a static
  // placeholder instead of a canvas has finished, and `canvasDrawn` can never
  // say so. See `RenderLifecycleMixin.painted`.
  painted: boolean
  // The positioned dendrogram of a display with a tree sidebar, published as
  // `data-clustered`.
  hierarchy?: unknown
  configuration: { displayId: string }
  height: number
} & AnimationHost &
  DisplayErrorBarModel &
  TooLargeMessageModel &
  DisplayLoadingOverlayModel &
  DisplayBackgroundProgressModel

export interface CanvasHandle {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
  /**
   * The container-relative pointer position, published rather than held. Read
   * it with `useMouseState(mouseTracker)` in the body, in the smallest
   * component that draws the cursor-following thing.
   */
  mouseTracker: MouseTracker
}

type ChromeDivProps = Omit<ComponentPropsWithRef<'div'>, 'children'>

export type DisplayChromeBaseProps<B> = {
  model: ChromeModel & RenderLifecycleModel<B>
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  children: (handle: CanvasHandle) => ReactNode
  /**
   * The display type's `data-testid`, the base name only and never mutated.
   * Readiness is `data-display-drawn` / `data-display-phase` (ADR-065);
   * `displayPainted(base)` from `@jbrowse/capture` composes the two.
   */
  testid: string
  overlays: DisplayChromeOverlays
  /**
   * Called with each measured pointer position (and `undefined` on leave), for
   * a display that hit-tests as the cursor moves. It runs off the same
   * measurement the tracker publishes, so a display's hit and its guides come
   * from one rect in one frame.
   */
  onPointerPosition?: (state?: MouseState) => void
} & ChromeDivProps

/**
 * A pointer event that asks "what is under this pixel": anything but the
 * enter/leave pairs, which keep firing from a portalled overlay because
 * leaving the page from one is how a display learns to clear its hover.
 */
function asksWhereThePointerIs(key: string) {
  return (
    /^on(Mouse|Pointer|Aux|Click|ContextMenu|DoubleClick|Wheel)/.test(key) &&
    !/(Enter|Leave)$/.test(key)
  )
}

/**
 * The caller's pointer handlers, rebound to fire only for pointers over the
 * chrome. React events bubble through the component tree, not the DOM, so a
 * context menu, legend or track control portalled elsewhere still delivers its
 * pointer events here as though they had happened on the canvas. A portalled
 * target is not inside this element, which is how the DOM tells them apart.
 */
function overChrome(props: ChromeDivProps): ChromeDivProps {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => {
      if (!asksWhereThePointerIs(key) || typeof value !== 'function') {
        return [key, value]
      }
      const handler = value as MouseEventHandler<HTMLDivElement>
      return [
        key,
        (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.currentTarget.contains(event.target as Node)) {
            handler(event)
          }
        },
      ]
    }),
  )
}

/**
 * The render lifecycle and status chrome of every LGV display. It owns the
 * backend hook (`useRenderingBackend`) and branches on `model.displayPhase`,
 * whose precedence lives in `computeDisplayPhase`, so a display cannot paint a
 * canvas while skipping a terminal state. What the states look like comes in
 * through `overlays`, which keeps this file free of any UI toolkit;
 * `DisplayChrome` binds the Material set.
 *
 * `renderError` and `tooLarge` return their own root: the unmount is what
 * fires `canvasRef(null)` and `backend.dispose()`, so the caller's
 * `className`, `ref` and handlers are absent in those states. `error`,
 * `canceled` and `loading` draw over the mounted body.
 *
 * The body is a render prop so callers mount the canvas where it belongs. It
 * runs during this component's render, so an observable read written inline in
 * it re-renders the whole chrome: put only components in it.
 */
const DisplayChromeBase = observer(function DisplayChromeBase<
  B extends RenderingBackend,
>({
  model,
  factory,
  children,
  overlays,
  testid,
  style,
  onPointerPosition,
  onMouseMove,
  onMouseLeave,
  ...divProps
}: DisplayChromeBaseProps<B>) {
  const { RenderError, TooLarge, ErrorBar, Loading, BackgroundProgress } =
    overlays
  const { canvas, canvasRef, retry, canvasKey } = useRenderingBackend(
    factory,
    model,
  )
  const { mouseTracker, handleMouseMove, handleMouseLeave } =
    useMouseTracking(onPointerPosition)
  // element state rather than a ref, so `BottomRightIndicators` re-renders
  // once the corner mounts
  const [cornerEl, setCornerEl] = useState<HTMLDivElement | null>(null)
  const phase = model.displayPhase
  // `mouseleave` cannot fire on an element unmounted under the cursor, so a
  // replacing phase would leave the tracker publishing the position the
  // pointer had when the banner went up, and the body would draw a crosshair
  // there on its first render after Force load or Retry.
  const containerMounted = phase !== 'renderError' && phase !== 'tooLarge'
  useEffect(() => {
    if (!containerMounted) {
      handleMouseLeave()
    }
  }, [containerMounted, handleMouseLeave])
  useAnimationFrames(model)
  if (phase === 'renderError') {
    return (
      <ReplacedDisplay model={model} phase={phase}>
        <RenderError
          error={model.renderError}
          onRetry={retry}
          height={model.height}
        />
      </ReplacedDisplay>
    )
  }
  if (phase === 'tooLarge') {
    return (
      <ReplacedDisplay model={model} phase={phase}>
        <TooLarge model={model} />
      </ReplacedDisplay>
    )
  }
  const drawn = model.painted
  return (
    <div
      {...overChrome({
        ...divProps,
        // composed, never replacing: maf's drag-selection binds its own
        onMouseMove: event => {
          handleMouseMove(event)
          onMouseMove?.(event)
        },
        onMouseLeave: event => {
          handleMouseLeave()
          onMouseLeave?.(event)
        },
      })}
      // The chrome owns the box: the overlays, guides and the display's own
      // content are all absolutely positioned, so without the height the
      // container collapses and takes no pointer events.
      style={{ position: 'relative', height: model.height, ...style }}
      data-testid={testid}
      data-display-id={model.configuration.displayId}
      // first paint, true even while the fetch is still running
      data-display-drawn={drawn}
      // finished: every value but `loading`
      data-display-phase={phase}
      // A figure that clusters with the sidebar hidden has no other DOM
      // evidence the run finished, so the capture gates wait on this.
      data-clustered={
        'hierarchy' in model ? String(!!model.hierarchy) : undefined
      }
      // The capture waits hold until no display reads `true`, so a figure is
      // never taken between a morph's two pictures.
      data-display-animating={
        'animating' in model ? String(!!model.animating) : undefined
      }
    >
      <BottomRightCornerContext value={cornerEl}>
        {/* `ContextMenu` calls this on close: a menu portalled to the body
            takes the hover chain with it, so the container never gets the
            `mouseleave` that would drop the tracked pointer. */}
        <ClearTrackedPointerProvider value={handleMouseLeave}>
          {/* Keyed so a backend re-init always gets a canvas element that
              never held a context: a canvas's context kind is permanent, and
              a device loss can land the HAL ladder on a different rung. */}
          <Fragment key={canvasKey}>
            {children({ canvasRef, canvas, mouseTracker })}
          </Fragment>
        </ClearTrackedPointerProvider>
      </BottomRightCornerContext>
      {/* Detected structurally, so a display gets each guide by answering its
          host members. Outside the canvas key, like the overlays below:
          remounting the loading scrim would reset its anti-flash timer. */}
      {isHighlightHost(model) ? <ChromeHighlight model={model} /> : null}
      {isAxisHost(model) ? <ChromeYAxis model={model} /> : null}
      {/* In the TrackContainer's overlay layer rather than inline, where the
          LGV's inter-region masks would stripe them (ADR-058). One portal for
          the group, so every overlay set inherits it. */}
      <TrackOverlayPortal>
        <ErrorBar model={model} visible={phase === 'error'} />
        <Loading
          model={model}
          visible={phase === 'loading' || phase === 'canceled'}
          // nothing painted yet, so nothing for the indicator to flash over
          immediate={!drawn}
        />
        {/* The bottom-right corner, shared by the status chip and the
            display's own control row, which portals in through the context
            above (bottomRightCorner.ts). No `z-index`, so it creates no
            stacking context and its two members keep competing in the overlay
            layer on their own values. */}
        <div
          ref={setCornerEl}
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          {/* Bare, with no wrapper: a wrapper would stay a zero-height flex
              item and spend the `gap`, lifting the control row 4px. */}
          <BackgroundProgress model={model} visible={phase === 'ready'} />
        </div>
      </TrackOverlayPortal>
      {isLegendHost(model) ? <ChromeLegend model={model} /> : null}
    </div>
  )
})

export default DisplayChromeBase
