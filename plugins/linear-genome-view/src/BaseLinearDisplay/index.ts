export { default as baseLinearDisplayConfigSchema } from './models/configSchema.ts'
export type { ExportSvgDisplayOptions, LayoutRecord } from './types.ts'

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
export { MIN_DISPLAY_HEIGHT } from './models/const.ts'

export { default as RegionTooLargeMixin } from '../shared/RegionTooLargeMixin.tsx'
export {
  type ByteEstimateConfig,
  type FetchContext,
  type MultiRegionDisplayMixinType,
  autorunOnReadyView,
  default as MultiRegionDisplayMixin,
  fetchAllRegions,
  fetchEachRegion,
  onDisplayedRegionsChange,
} from './models/MultiRegionDisplayMixin.ts'
export {
  type GlobalDataDisplayMixinType,
  default as GlobalDataDisplayMixin,
} from './models/GlobalDataDisplayMixin.ts'
export {
  type StaleViewportRescaleMixinType,
  default as StaleViewportRescaleMixin,
} from './models/StaleViewportRescaleMixin.ts'
export {
  type RenderTransform,
  type RenderTransformInputs,
  computeRenderTransform,
} from './models/renderTransform.ts'
export { drawCanvasImageData } from './util.ts'
export {
  TOO_MANY_FEATURES_REASON,
  bytesTooLargeReason,
  evaluateRegionTooLarge,
  getDisplayStr,
  resolveByteLimit,
} from '../shared/featureDensityUtils.ts'
export type { RegionTooLargeStatus } from '../shared/featureDensityUtils.ts'
export { default as TooLargeMessage } from '../shared/TooLargeMessage.tsx'
export { default as FloatingLegend } from './components/FloatingLegend.tsx'
