import type { TooLargeMessageModel } from '../../shared/TooLargeMessage.tsx'
import type { DisplayBackgroundProgressModel } from './DisplayBackgroundProgress.tsx'
import type { DisplayErrorBarModel } from './DisplayErrorBar.tsx'
import type { DisplayLoadingOverlayModel } from './DisplayLoadingOverlay.tsx'
import type { ComponentType } from 'react'

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
   */
  BackgroundProgress: ComponentType<{
    model: DisplayBackgroundProgressModel
    visible: boolean
  }>
}
