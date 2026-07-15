export { default as baseLinearDisplayConfigSchema } from './models/configSchema.ts'
export type {
  ExportSvgDisplayOptions,
  LayoutRecord,
  LinearDisplayModel,
} from './types.ts'

export {
  BlockMsg,
  Tooltip,
  default as BaseLinearDisplayComponent,
} from './components/BaseLinearDisplay.tsx'
export type { LegendItem, LegendSection } from './components/FloatingLegend.tsx'
export { default as DisplayChrome } from './components/DisplayChrome.tsx'
export type { ChromeModel } from './components/DisplayChrome.tsx'
export { default as DisplayErrorBar } from './components/DisplayErrorBar.tsx'
export { default as DisplayLoadingOverlay } from './components/DisplayLoadingOverlay.tsx'
export { default as TrackHeightMixin } from './models/TrackHeightMixin.tsx'
export {
  default as HeightModeMixin,
  installGrowExitBake,
} from './models/HeightModeMixin.ts'
export { default as PromotableDefaultsMixin } from './models/PromotableDefaultsMixin.tsx'
export { MIN_DISPLAY_HEIGHT } from './models/const.ts'
export {
  GROW_MAX_HEIGHT,
  HEIGHT_MODE_VALUES,
  getHeightModeOptions,
} from './models/heightMode.ts'
export type { HeightMode } from './models/heightMode.ts'
export {
  getTrackSizingMenuItem,
  heightModeMenuItems,
} from './models/heightModeMenu.ts'
export type { HeightModeMenuModel } from './models/heightModeMenu.ts'

export { default as RegionTooLargeMixin } from '../shared/RegionTooLargeMixin.tsx'
export {
  type ByteEstimateConfig,
  type FetchContext,
  type MultiRegionDisplayMixinType,
  autorunOnReadyView,
  checkByteEstimate,
  default as MultiRegionDisplayMixin,
  fetchAllRegions,
  fetchEachRegion,
  onDisplayedRegionsChange,
} from './models/MultiRegionDisplayMixin.ts'
export {
  type GlobalDataDisplayMixinType,
  GlobalFetchMixin,
  type GlobalFetchMixinType,
  default as GlobalDataDisplayMixin,
  installGlobalFetchAutorun,
} from './models/GlobalDataDisplayMixin.ts'
export {
  type FetchMixinType,
  default as FetchMixin,
} from './models/FetchMixin.ts'
export {
  type StaleViewportRescaleMixinType,
  default as StaleViewportRescaleMixin,
} from './models/StaleViewportRescaleMixin.ts'
export {
  type RenderTransform,
  type RenderTransformInputs,
  computeRenderTransform,
  computeTriangleYScalar,
  viewportMatchesLastDrawn,
} from './models/renderTransform.ts'
export { drawCanvasImageData } from './util.ts'
export {
  TOO_MANY_FEATURES_REASON,
  bytesTooLargeReason,
  evaluateRegionTooLarge,
  getDisplayStr,
  raiseLimitPast,
  resolveByteLimit,
  scaleByteEstimate,
  scaledForceLoadByteLimit,
} from '../shared/featureDensityUtils.ts'
export type { RegionTooLargeStatus } from '../shared/featureDensityUtils.ts'
export { default as TooLargeMessage } from '../shared/TooLargeMessage.tsx'
export { default as FloatingLegend } from './components/FloatingLegend.tsx'
export { default as TrackHeightIndicator } from './components/TrackHeightIndicator.tsx'
