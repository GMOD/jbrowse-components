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
   * Fetch error, drawn *over* a live canvas rather than replacing it. Renders
   * null when `model.error` is unset -- the chrome mounts it unconditionally.
   */
  ErrorBar: ComponentType<{ model: DisplayErrorBarModel }>
  /**
   * The loading scrim. `visible` is `displayPhase === 'loading'`; `immediate`
   * asks it to skip its anti-flash delay because nothing is painted yet.
   * Mounted unconditionally, so it must handle `visible === false` itself.
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
