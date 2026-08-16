import type { ComponentType } from 'react'

// The model each overlay is handed, and the reason they are declared here
// rather than beside the components that read them: a *set* is written against
// these, so a host writing one needs them exported — and a component wrapped in
// `observer()` gets no contextual type for its props, so naming the shape
// structurally in `DisplayChromeOverlays` is not enough. They lived in
// JBrowse's own Material overlays until this package existed, which made the
// contract un-nameable without importing an implementation of it.
//
// Structural, not MST types. A display satisfies one by having the fields; no
// mixin has to be composed and no model type is named across a lazy boundary.

/** What `ErrorBar` reads: a failed fetch, and the way to run it again. */
export interface DisplayErrorBarModel {
  error: unknown
  reload: () => void
}

/** What `Loading` reads. Everything is optional — a display that reports no
 * progress and offers no cancel still gets a scrim. */
export interface DisplayLoadingOverlayModel {
  statusMessage?: string
  statusProgress?: number
  fetchCanceled?: boolean
  cancelFetchByUser?: () => void
  reload?: () => void
}

/** What `BackgroundProgress` reads: the status channel for work with no fetch
 * behind it, while the phase is `ready`. */
export interface DisplayBackgroundProgressModel {
  statusMessage?: string
  statusProgress?: number
}

/** What `TooLarge` reads. `forceLoad` is the whole point of the state — see the
 * entry below. */
export interface TooLargeMessageModel {
  regionTooLargeReason: string
  zoomCanReleaseGate: boolean
  forceLoad: () => void
}

// The five components that draw `displayPhase`'s terminal and overlay states.
// DisplayChromeBase decides WHICH of them renders; this interface is how it
// stays ignorant of WHAT they render.
//
// Every import above is type-only and therefore erased, so this module pulls no
// runtime dependency. That is the point: it lets `DisplayChromeBase` be free of
// MUI, so an embedder with its own design system can supply plain markup and
// neither ship MUI nor be forced to mount a ThemeProvider. `DisplayChrome`
// (the default export every in-tree display uses) binds the MUI set, so nothing
// in this repo changes appearance.
//
// Prop shapes are exactly what DisplayChromeBase passes today. A replacement
// set is only obliged to render *something* for each state -- but see the
// testids in `plainChromeOverlays.tsx`, which four test systems key on.
//
// One layout obligation, and it applies to any set: the three non-terminal
// states (`ErrorBar`, `Loading`, `BackgroundProgress`) are portaled as a group
// into the LGV's per-track overlay layer, so they clear the inter-region masks
// that would otherwise stripe them at multi-region scale. That layer is
// `pointer-events:none`, so anything of yours the user clicks -- a retry, a
// cancel -- has to set `pointer-events:auto` on its own positioned box. The
// shipped sets and the examples-site set all do; the states own their box, so
// nothing can default it for them.
//
// `BackgroundProgress` is the exception to that last clause -- the chrome owns
// its placement, because its corner is shared with something the overlay set
// cannot see. See its entry below.
export interface DisplayChromeOverlays {
  /**
   * GPU/render-backend failure. A subtree-replacing terminal state: the canvas
   * unmounts and the backend disposes, so this owns the full display area.
   */
  RenderError: ComponentType<{
    error: unknown
    onRetry: () => void
    height: number
  }>
  /**
   * The byte gate tripped. Also subtree-replacing. Must offer `model.forceLoad`
   * or the region becomes unreachable for the rest of the session.
   */
  TooLarge: ComponentType<{ model: TooLargeMessageModel }>
  /**
   * Fetch error, drawn *over* a live canvas rather than replacing it. Mounted
   * unconditionally like the two below, so `visible` (`displayPhase ===
   * 'error'`) is the gate -- don't re-derive it from `model.error`, which is
   * the same subtraction `displayPhase` exists to retire.
   */
  ErrorBar: ComponentType<{ model: DisplayErrorBarModel; visible: boolean }>
  /**
   * The loading scrim. `visible` is `displayPhase === 'loading'`; `immediate`
   * asks it to skip its anti-flash delay because nothing is painted yet.
   *
   * Mounted unconditionally, so it must handle `visible === false` itself — and
   * that is load-bearing rather than a style choice: the anti-flash delay is
   * component state, so a chrome that mounted this only while loading would
   * restart the timer on every activation and never reach it. Keep any
   * replacement mountable-while-hidden for the same reason.
   */
  Loading: ComponentType<{
    model: DisplayLoadingOverlayModel
    visible: boolean
    immediate?: boolean
  }>
  /**
   * Status for work with no fetch behind it, while the phase is `ready`.
   * Mounted unconditionally; gates on `visible` itself.
   *
   * **The one state that does not own its own box.** The chrome anchors the
   * bottom-right corner and lays this out there, because that corner is shared
   * with the display's own control row (`BottomRightIndicators`) and two boxes
   * claiming it independently is exactly what they used to do — each pinning
   * itself to `bottom: 2; right: 2` of the same overlay layer, the controls
   * winning on z-index and the status text vanishing underneath. So render an
   * **in-flow** chip: no `position`, no `inset`, no corner offsets. Sizing and
   * colours are yours; placement is not. See `bottomRightCorner.ts`.
   */
  BackgroundProgress: ComponentType<{
    model: DisplayBackgroundProgressModel
    visible: boolean
  }>
}
