export { default as baseLinearDisplayConfigSchema } from './models/configSchema.ts'
export type { ExportSvgDisplayOptions, LayoutRecord } from './types.ts'

export {
  BlockMsg,
  DisplayContainer,
  default as BaseLinearDisplayComponent,
} from './components/BaseLinearDisplay.tsx'
export type { LegendItem, LegendSection } from './components/FloatingLegend.tsx'
export { default as DisplayChrome } from './components/DisplayChrome.tsx'
export type { ChromeModel } from './components/DisplayChrome.tsx'
// The toolkit-free half of the chrome, for embedders supplying their own
// overlays. Importing DisplayChromeBase + plainChromeOverlays instead of
// DisplayChrome keeps MUI out of the graph entirely; see chromeOverlays.ts.
export { DisplayChromeOverlayProvider } from './components/DisplayChrome.tsx'
export { default as DisplayChromeBase } from './components/DisplayChromeBase.tsx'
export { default as plainChromeOverlays } from './components/plainChromeOverlays.tsx'
export type { DisplayChromeOverlays } from './components/chromeOverlays.ts'
export { default as DisplayErrorBar } from './components/DisplayErrorBar.tsx'
export { default as DisplayLoadingOverlay } from './components/DisplayLoadingOverlay.tsx'
export { default as TrackHeightMixin } from './models/TrackHeightMixin.tsx'
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
