import type { ComponentType } from 'react'

// The model each overlay is handed, declared here so a host writing an overlay
// set can name them without importing an implementation. Structural: a display
// satisfies one by having the fields.

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
// `DisplayChromeBase` decides which renders; this interface keeps it ignorant
// of what they render, and so free of MUI: an embedder with its own design
// system supplies plain markup and ships no ThemeProvider. Every import above
// is type-only, so this module pulls no runtime dependency.
//
// A replacement set must render something for each state; four test systems
// key on the testids in `plainChromeOverlays.tsx`.
//
// `ErrorBar`, `Loading` and `BackgroundProgress` are portalled as a group into
// the LGV's per-track overlay layer, which is `pointer-events: none`, so
// anything of yours the user clicks sets `pointer-events: auto` on its own
// positioned box. `BackgroundProgress` alone does not own its box; see its
// entry.
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
   * The loading scrim. `visible` is `displayPhase` `loading` or `canceled`,
   * the second drawn from `model.fetchCanceled` with Retry in place of Cancel;
   * `immediate` asks it to skip its anti-flash delay because nothing is painted
   * yet.
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
   * colors are yours; placement is not. See `bottomRightCorner.ts`.
   */
  BackgroundProgress: ComponentType<{
    model: DisplayBackgroundProgressModel
    visible: boolean
  }>
}
