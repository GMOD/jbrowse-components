import { useState } from 'react'

import {
  BottomRightCornerContext,
  TrackOverlayPortal,
} from '@jbrowse/display-ui'

import type { TooLargeMessageModel } from '../../shared/TooLargeMessage.tsx'
import type { DisplayBackgroundProgressModel } from './DisplayBackgroundProgress.tsx'
import type { DisplayErrorBarModel } from './DisplayErrorBar.tsx'
import type { DisplayLoadingOverlayModel } from './DisplayLoadingOverlay.tsx'
import type { DisplayChromeOverlays } from '@jbrowse/display-ui'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type { ComponentPropsWithRef, MouseEventHandler, ReactNode } from 'react'

// The model contract is the *union of what the sub-overlays read*, composed
// directly from each overlay's own model prop type so it can't drift: add or
// remove a field an overlay reads and this updates with no edit here — plus the
// one field this component reads for itself, spelled out separately for that
// reason. `configuration.displayId` is the same structural shape the repo-wide
// display check uses (see configurationSchema.ts), so every concrete display
// satisfies it already.
export type StatusChromeModel = DisplayErrorBarModel &
  TooLargeMessageModel &
  DisplayLoadingOverlayModel &
  DisplayBackgroundProgressModel & {
    configuration: { displayId: string }
  }

// Everything the status chrome is, minus the rendering backend: the phase
// branch, the positioning container, the four published `data-*` attributes,
// and the four overlays that need no `retry()`.
//
// It exists as its own component because two displays need exactly this and
// only one of them has a GPU backend. `DisplayChromeBase` wraps it with
// `useRenderingBackend` + the `renderError` phase (the only phase whose banner
// needs the hook's `retry`); arc, which renders main-thread SVG and has no
// backend to fail, renders it directly with `svgReady`'s looser sibling as
// `drawn`. Before this split arc hand-copied the whole branch and had already
// drifted — it rendered no background-progress chip at all. A display's
// alignment with the chrome should cost it a prop, not a copy.
//
// Deliberately NOT an observer, and it reads no observable: `phase` and `drawn`
// arrive as props so the *caller* is the one tracking them (both callers are
// observers). That keeps the tracked set exactly where it was and leaves this
// component safe for babel-plugin-react-compiler to compile — there is no MobX
// read here to stale.
//
// The `tooLarge` phase **early-`return`s** its own root rather than nesting
// under the container below. For a GPU display that unmount is what fires
// `canvasRef(null)` → `backend.dispose()` (ADR-025), and it is why the caller's
// className/ref/handlers are absent in that state: a too-large region has no
// canvas to interact with, and the ref re-attaches on force-load. Don't "fix"
// it by nesting the banner. `error` and `loading` are overlays drawn *over* the
// still-mounted body.
// Exported for the same reason `DisplayChromeBaseProps` is: `DisplayStatusChrome`
// binds `overlays` off this type instead of restating the list.
export type DisplayStatusChromeBaseProps = {
  model: StatusChromeModel
  /**
   * The display's own mutually-exclusive state, ranked by
   * `computeDisplayStatusPhase`. Never re-derived here — this component only
   * branches on it, so a display and its chrome can't disagree.
   */
  phase: DisplayStatusPhase
  /**
   * First paint: `painted` for a GPU display, arc's own `painted` for SVG.
   * Drives the published `data-display-drawn` and the loading overlay's
   * anti-flash suppression while there is nothing on screen to flash over.
   *
   * **`painted`, not the raw `canvasDrawn`.** A display showing a deliberate
   * static placeholder instead of a canvas never mounts one, so `canvasDrawn`
   * cannot flip and `data-display-drawn` reported `"false"` for the display's
   * whole life — which is what `PENDING_DISPLAYS` selects on, so a zoomed-out
   * reference sequence track timed out every `waitForDisplaysDone` on the page.
   * See `RenderLifecycleMixin.painted`.
   */
  drawn: boolean
  overlays: DisplayChromeOverlays
  /**
   * The display type's stable `data-testid`. **Required** — it used to be
   * optional, and the displays that omitted it leaned on a second wrapper
   * element (`DisplayContainer`) to emit an id instead, which is how the repo
   * ended up with three testid shapes and a test-infra union to match them.
   *
   * Pass the base name only. It used to gain `-done` on paint; readiness is
   * `data-display-drawn` / `data-display-phase` now (ADR-065), so a consumer
   * that wants "this display type, painted" composes the two —
   * `displayPainted(base)` from `@jbrowse/capture`.
   */
  testid: string
  children?: ReactNode
} & Omit<ComponentPropsWithRef<'div'>, 'children'>

/**
 * A pointer handler that fires only for pointers actually over the chrome.
 *
 * REACT EVENTS DO NOT STOP AT A PORTAL: they bubble through the COMPONENT tree,
 * not the DOM one. Everything a display floats above itself -- a context menu, a
 * colour legend, the track control -- is portalled to another node while staying
 * a React child of this div, so its clicks arrived here as though they had
 * happened on the canvas. A display that hit-tests `onClick` then answered them,
 * and picking a menu item or dismissing a legend also opened the feature that
 * happened to be underneath.
 *
 * The DOM says which is which: a portalled target is not inside this element.
 */
const overChrome =
  (handler: MouseEventHandler<HTMLDivElement> | undefined) =>
  (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.target as Node)) {
      handler?.(event)
    }
  }

export default function DisplayStatusChromeBase({
  model,
  phase,
  drawn,
  overlays,
  testid,
  style,
  children,
  onClick,
  onContextMenu,
  ...divProps
}: DisplayStatusChromeBaseProps) {
  // Destructured so the JSX below reads as ordinary components rather than
  // `<overlays.TooLarge/>` member expressions. `overlays` is a plain prop of
  // component types (not an observable, not an MST model), so pulling the
  // fields out has none of the staleness hazard the "don't destructure the
  // model" rule is about.
  const { TooLarge, ErrorBar, Loading, BackgroundProgress } = overlays
  // element state rather than a ref, so `BottomRightIndicators` re-renders once
  // the corner mounts and its context value flips from null to the node — the
  // same shape `TrackContainer` uses for the overlay layer, for the same reason.
  // Declared above the early return because it is a hook.
  const [cornerEl, setCornerEl] = useState<HTMLDivElement | null>(null)
  if (phase === 'tooLarge') {
    return <TooLarge model={model} />
  }
  return (
    <div
      {...divProps}
      // Only the pointers that happened over this element, so a portalled
      // overlay's clicks are not answered as canvas hits -- see `overChrome`.
      onClick={overChrome(onClick)}
      onContextMenu={overChrome(onContextMenu)}
      // The chrome owns the positioning context: the loading scrim and error
      // bar below are position:absolute children, so the container must be the
      // containing block. Centralized here so no caller has to remember it (and
      // so the ones that didn't — hic, ld — stop leaking their overlays to an
      // ancestor). Caller `style` still wins if it overrides `position`.
      style={{ position: 'relative', ...style }}
      // Stable for the display's whole life — the display TYPE, shared by every
      // instance of it. It used to gain a `-done` suffix on first paint, which
      // made it the only mutating testid in the tree and gave readiness two
      // spellings (`-done` here, `_done` on the two chrome-less views). ADR-065
      // deleted that: the three attributes below already carry identity, paint
      // and phase separately, and a suffix could carry only one of them.
      data-testid={testid}
      // WHICH display this is. `data-testid` cannot serve it — it names the
      // type, so every instance shares one. Targeting a single track's display
      // used to mean a second wrapper emitting `display-${displayId}` as its
      // testid, a whole extra element.
      data-display-id={model.configuration.displayId}
      // FIRST PAINT — true once something has been drawn, even if the fetch is
      // still running. "Has every display painted?" is `[data-display-drawn=
      // "false"]`, one selector across every view, because `RenderCanvas`
      // publishes it for the chrome-less two as well.
      data-display-drawn={drawn}
      // FINISHED, which paint alone cannot answer: `drawn` flips on an empty
      // canvas mid-fetch. `phase` is the model's own mutually-exclusive state,
      // and `loading` covers the whole fetch, not just the paint. Published so a
      // screenshot/e2e run can wait on the real signal instead of inferring it
      // from paint flags and overlay text. NOTE the two subtree-replacing
      // phases (`tooLarge` above, `renderError` in DisplayChromeBase) publish no
      // attribute at all, since they don't render this container — a
      // `[data-display-phase]` census counts them as absent, not as terminal.
      data-display-phase={phase}
    >
      {/* The corner node reaches the body through context, because the row that
          fills it (`BottomRightIndicators`) is rendered by the display, several
          components down, and the anchor is rendered by the chrome. */}
      <BottomRightCornerContext value={cornerEl}>
        {children}
      </BottomRightCornerContext>
      {/* The status overlays are the display's *chrome*, not its data, so they
          belong in the TrackContainer's overlay layer rather than inside the
          `contain:strict` sandbox the LGV's inter-region masks paint over.
          Inline, a region separator bar drew straight across the loading chip
          and the error banner at whole-genome / multi-region scale, and no
          z-index inside the sandbox can win against a sibling painted after it.

          One portal here rather than one per overlay: the group shares a box
          (the display's own, which is what the portal target is), so it lands
          in the coordinates it had inline, and — the reason it's at this level —
          BOTH overlay sets inherit it. Put it in the MUI overlays and the plain
          set silently keeps the bug, which is exactly how the two drifted
          before. `children` stays behind: that's the canvas, and the masks are
          supposed to cover it.

          Outside a TrackContainer (unit tests, SVG export, a display an
          embedder mounts standalone) the portal renders in place, so this is
          invisible to everything but the LGV. */}
      <TrackOverlayPortal>
        <ErrorBar model={model} visible={phase === 'error'} />
        <Loading
          model={model}
          visible={phase === 'loading'}
          // initial load (nothing painted yet) shows the indicator immediately;
          // a refetch over already-drawn content keeps the anti-flash delay
          immediate={!drawn}
        />
        {/* The bottom-right corner, owned here so the two things that want it
            cannot claim it independently — the status chip below, and the
            display's own control row, which portals in through the context
            above. See bottomRightCorner.ts. An empty flex box has no size, so a
            display with neither renders nothing.

            `pointer-events` stays `none`, the overlay layer's own value: the
            control row sets `auto` on its own box and the chip never wants it.

            Deliberately carries NO `z-index`, so it creates no stacking context
            and its two members go on competing in the overlay layer exactly as
            they did when each was its own box there — the chip at 2, under the
            tree sidebar, the legends and the cluster hints at 100; the row at
            999, over them. A `z-index` here would have lifted the chip over all
            of those as a side effect of sharing a parent. Flex items honour
            `z-index` with no `position` of their own (Flexbox §5.4), so the two
            can keep their own values without either needing to be positioned. */}
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
          {/* The same status channel, for work with no fetch behind it
              (clustering) — a corner chip, since the drawn content stays usable
              meanwhile. In flow here rather than anchoring itself, which is what
              used to put it underneath the control row.

              Rendered bare, with no wrapper of its own: a component returning
              null contributes no DOM node, while a wrapper around it would stay
              a zero-height flex ITEM and spend the `gap` above — lifting the
              control row 4px on every display that has one and no status. It
              takes CSS's default `order: 0` and the row asks for
              `BOTTOM_RIGHT_CONTROLS_ORDER` to sort below it. */}
          <BackgroundProgress model={model} visible={phase === 'ready'} />
        </div>
      </TrackOverlayPortal>
    </div>
  )
}
