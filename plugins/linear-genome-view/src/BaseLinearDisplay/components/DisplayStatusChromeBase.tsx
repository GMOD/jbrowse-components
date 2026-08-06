import type { TooLargeMessageModel } from '../../shared/TooLargeMessage.tsx'
import type { DisplayBackgroundProgressModel } from './DisplayBackgroundProgress.tsx'
import type { DisplayErrorBarModel } from './DisplayErrorBar.tsx'
import type { DisplayLoadingOverlayModel } from './DisplayLoadingOverlay.tsx'
import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type { ComponentPropsWithRef, ReactNode } from 'react'

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
// branch, the positioning container, the `-done` testid, the published
// `data-display-phase`, and the four overlays that need no `retry()`.
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
export default function DisplayStatusChromeBase({
  model,
  phase,
  drawn,
  overlays,
  testid,
  style,
  children,
  ...divProps
}: {
  model: StatusChromeModel
  /**
   * The display's own mutually-exclusive state, ranked by
   * `computeDisplayStatusPhase`. Never re-derived here — this component only
   * branches on it, so a display and its chrome can't disagree.
   */
  phase: DisplayStatusPhase
  /**
   * First paint: `painted` for a GPU display, arc's own `painted` for SVG.
   * Drives the `-done` testid suffix, the published `data-display-drawn`, and
   * the loading overlay's anti-flash suppression while there is nothing on
   * screen to flash over.
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
   * Base first-paint selector; this owns the `-done` convention. **Required** —
   * it used to be optional, and the displays that omitted it leaned on a second
   * wrapper element (`DisplayContainer`) to emit an id instead, which is how the
   * repo ended up with three testid shapes and a test-infra union to match them.
   */
  testid: string
  children?: ReactNode
} & Omit<ComponentPropsWithRef<'div'>, 'children'>) {
  // Destructured so the JSX below reads as ordinary components rather than
  // `<overlays.TooLarge/>` member expressions. `overlays` is a plain prop of
  // component types (not an observable, not an MST model), so pulling the
  // fields out has none of the staleness hazard the "don't destructure the
  // model" rule is about.
  const { TooLarge, ErrorBar, Loading, BackgroundProgress } = overlays
  if (phase === 'tooLarge') {
    return <TooLarge model={model} />
  }
  return (
    <div
      {...divProps}
      // The chrome owns the positioning context: the loading scrim and error
      // bar below are position:absolute children, so the container must be the
      // containing block. Centralized here so no caller has to remember it (and
      // so the ones that didn't — hic, ld — stop leaking their overlays to an
      // ancestor). Caller `style` still wins if it overrides `position`.
      style={{ position: 'relative', ...style }}
      data-testid={`${testid}${drawn ? '-done' : ''}`}
      // The display's identity, stable across its whole life. `data-testid`
      // cannot serve this: it is the *base*, shared by every instance of a
      // display type, and it mutates on first paint. Targeting one track's
      // display used to mean a second wrapper emitting `display-${displayId}` as
      // its testid — a whole extra element, and a second `-done` emitter with
      // the same gate.
      data-display-id={model.configuration.displayId}
      // First paint as its own stable attribute, rather than only as the `-done`
      // suffix mutating `data-testid`. "Has every display painted?" is then one
      // selector (`[data-display-drawn="false"]`) instead of a union that had to
      // enumerate the testid shapes and go negative on the suffix.
      data-display-drawn={drawn}
      // The `-done` suffix above is FIRST PAINT — it flips on an empty canvas
      // while the fetch is still in flight, so it can't answer "is this display
      // finished". `phase` can: it is the model's own mutually-exclusive state,
      // and `loading` covers the whole fetch, not just the paint. Published so a
      // screenshot/e2e run can wait on the real signal instead of inferring it
      // from paint flags and overlay text. NOTE the two subtree-replacing
      // phases (`tooLarge` above, `renderError` in DisplayChromeBase) publish no
      // attribute at all, since they don't render this container — a
      // `[data-display-phase]` census counts them as absent, not as terminal.
      data-display-phase={phase}
    >
      {children}
      <ErrorBar model={model} visible={phase === 'error'} />
      <Loading
        model={model}
        visible={phase === 'loading'}
        // initial load (nothing painted yet) shows the indicator immediately;
        // a refetch over already-drawn content keeps the anti-flash delay
        immediate={!drawn}
      />
      {/* the same status channel, for work with no fetch behind it (clustering)
          — a corner chip, since the drawn content stays usable meanwhile */}
      <BackgroundProgress model={model} visible={phase === 'ready'} />
    </div>
  )
}
