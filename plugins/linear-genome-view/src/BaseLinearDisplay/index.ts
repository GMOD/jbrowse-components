export { default as baseLinearDisplayConfigSchema } from './models/configSchema.ts'
export type { ExportSvgDisplayOptions, LayoutRecord } from './types.ts'

export { default as BlockMsg } from '../shared/BlockMsg.tsx'
export type { LegendItem, LegendSection } from './components/FloatingLegend.tsx'
export { default as DisplayChrome } from './components/DisplayChrome.tsx'
export type { ChromeModel } from './components/DisplayChrome.tsx'
// Same chrome for a display with no rendering backend (arc's main-thread SVG):
// it supplies the phase and the first-paint flag itself. See DisplayChrome.tsx.
export { DisplayStatusChrome } from './components/DisplayChrome.tsx'
export { default as DisplayStatusChromeBase } from './components/DisplayStatusChromeBase.tsx'
export type { StatusChromeModel } from './components/DisplayChrome.tsx'
// The toolkit-free half of the chrome, for embedders supplying their own
// overlays. Importing DisplayChromeBase + plainChromeOverlays instead of
// DisplayChrome keeps MUI out of the graph entirely; see chromeOverlays.ts.
//
// The provider comes from the context module and NOT from DisplayChrome.tsx,
// which binds the Material set — see chromeOverlayContext.ts for what that one
// edge cost when it ran the other way.
export { DisplayChromeOverlayProvider } from './components/chromeOverlayContext.ts'
export { default as DisplayChromeBase } from './components/DisplayChromeBase.tsx'
export { default as plainChromeOverlays } from './components/plainChromeOverlays.tsx'
// Both seams at once, defaulting to the plain sets — what an embedder who does
// not want Material UI mounts, instead of the two providers by hand. The
// contexts themselves still default to undefined; see the component's comment.
export { default as DisplayUIProvider } from './components/DisplayUIProvider.tsx'
export type { DisplayChromeOverlays } from './components/chromeOverlays.ts'
export { default as DisplayErrorBar } from './components/DisplayErrorBar.tsx'
export { default as DisplayLoadingOverlay } from './components/DisplayLoadingOverlay.tsx'
// The model each overlay is handed. `DisplayChromeOverlays` names these types
// structurally, but that is not enough to write a set against it: a component
// wrapped in `observer()` gets no contextual type for its props, so a
// replacement has to name the model itself. Exported for exactly that.
export type { DisplayErrorBarModel } from './components/DisplayErrorBar.tsx'
export type { DisplayLoadingOverlayModel } from './components/DisplayLoadingOverlay.tsx'
export type { DisplayBackgroundProgressModel } from './components/DisplayBackgroundProgress.tsx'
export type { TooLargeMessageModel } from '../shared/TooLargeMessage.tsx'
export { default as TrackHeightMixin } from './models/TrackHeightMixin.tsx'
export { installClearHoverOnViewportChange } from './models/installClearHoverOnViewportChange.ts'
export {
  default as HeightModeMixin,
  installGrowExitBake,
} from './models/HeightModeMixin.ts'
export { MIN_DISPLAY_HEIGHT } from './models/const.ts'
export {
  GROW_MAX_HEIGHT,
  HEIGHT_MODE_VALUES,
  getHeightModeOptions,
  heightModeLabel,
} from './models/heightMode.ts'
export type { HeightMode } from './models/heightMode.ts'
export { heightModeMenuItems } from './models/heightModeMenu.ts'
export type { HeightModeMenuModel } from './models/heightModeMenu.ts'

export {
  type FetchContext,
  autorunOnReadyView,
  callEachRegion,
  default as MultiRegionDisplayMixin,
  fetchAllRegions,
  fetchEachRegion,
  onDisplayedRegionsChange,
} from './models/MultiRegionDisplayMixin.ts'
export {
  GlobalFetchMixin,
  type GlobalFetchMixinType,
  default as GlobalDataDisplayMixin,
  installGlobalFetchAutorun,
} from './models/GlobalDataDisplayMixin.ts'
export {
  type FetchMixinType,
  default as FetchMixin,
} from './models/FetchMixin.ts'
// The phase mapping the in-tree foundations share. Only the backend-free variant
// is public: it is what an out-of-tree SVG display (arc's shape) needs, and it
// is the alternative to that display hand-writing the object literal arc used to
// — which is how arc came to be the last foundation still doing so.
export { foundationDisplayStatusPhase } from './models/foundationDisplayPhase.ts'
export type { DisplayStatusPhaseFoundation } from './models/foundationDisplayPhase.ts'
export { default as StaleViewportRescaleMixin } from './models/StaleViewportRescaleMixin.ts'
export { squashToHeightCheckboxItem } from './models/squashToHeightMenuItem.ts'
export {
  computeRenderTransform,
  computeTriangleYScalar,
  viewportMatchesLastDrawn,
} from './models/renderTransform.ts'
export type {
  RenderTransform,
  RenderTransformInputs,
} from './models/renderTransform.ts'
export { default as TooLargeMessage } from '../shared/TooLargeMessage.tsx'
export { default as FloatingLegend } from './components/FloatingLegend.tsx'
export { default as TrackHeightIndicator } from './components/TrackHeightIndicator.tsx'
export { default as BottomRightIndicators } from './components/BottomRightIndicators.tsx'
export { default as TrackControl } from './components/trackControl/TrackControl.tsx'
// From the context module, not from the binder above it, for the reason on
// DisplayChromeOverlayProvider.
export { TrackControlProvider } from './components/trackControl/trackControlContext.ts'
export { default as plainTrackControl } from './components/trackControl/plainTrackControl.tsx'
export type {
  TrackControlComponent,
  TrackControlIcon,
  TrackControlOption,
  TrackControlProps,
} from './components/trackControl/types.ts'
