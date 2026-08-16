// The UI a display draws that is not data, and none of it reaches a UI toolkit.
//
// This package has no `@mui/*` dependency, which is the guarantee the whole
// bring-your-own story rests on and the one thing a rendered-element census
// cannot check. The Material implementations live in
// `@jbrowse/plugin-linear-genome-view`, which depends on this — never the
// reverse. See README.md.

// Both seams at once, defaulting to the plain sets: what an embedder mounts.
// `resolveOverlays` is the partial-over-plain merge on its own, for code
// building the context value by hand — it returns one stable object per input,
// which is what keeps a context value from re-rendering every display.
export {
  default as DisplayUIProvider,
  resolveOverlays,
} from './DisplayUIProvider.tsx'

// The status states.
export {
  DisplayChromeOverlayProvider,
  useChromeOverlayOverride,
} from './chromeOverlayContext.ts'
export { default as plainChromeOverlays } from './plainChromeOverlays.tsx'
export type {
  DisplayBackgroundProgressModel,
  DisplayChromeOverlays,
  DisplayErrorBarModel,
  DisplayLoadingOverlayModel,
  TooLargeMessageModel,
} from './chromeOverlays.ts'

// The bottom-right controls.
export {
  TrackControlProvider,
  useTrackControlOverride,
} from './trackControl/trackControlContext.ts'
export { default as plainTrackControl } from './trackControl/plainTrackControl.tsx'
export { useTrackControlMenu } from './trackControl/useTrackControlMenu.tsx'
export type { TrackControlMenu } from './trackControl/useTrackControlMenu.tsx'
export type {
  TrackControlComponent,
  TrackControlIcon,
  TrackControlOption,
  TrackControlProps,
} from './trackControl/types.ts'

// The per-track overlay layer: the node floating chrome escapes into, and the
// host's half of that portal.
export { TrackOverlayContext } from './trackOverlay/TrackOverlayContext.ts'
export { TrackOverlayPortal } from './trackOverlay/TrackOverlayPortal.tsx'
export { TrackOverlaySlot } from './trackOverlay/TrackOverlaySlot.tsx'

// What the byte gate says, so every set that renders the too-large state says
// the same thing. The measurement behind the gate stays with the mixin that
// makes it.
export { tooLargeBannerText } from './tooLargeBannerText.ts'

// The liveness check an overlay's one button needs, for a model that may be an
// MST node or the plain object the contract invites. Exported because both
// shipped sets render that button and a bare `isAlive` is wrong in each.
export { isLiveModel } from './isLiveModel.ts'

// The corner `BackgroundProgress` is laid out in — the half of that state's
// contract the prop types cannot carry, so it belongs with them rather than
// with the chrome that happens to mount it.
export {
  BOTTOM_RIGHT_CONTROLS_ORDER,
  BottomRightCornerContext,
} from './bottomRightCorner.ts'
