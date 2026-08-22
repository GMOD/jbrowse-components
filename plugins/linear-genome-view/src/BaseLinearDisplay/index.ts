export { default as baseLinearDisplayConfigSchema } from './models/configSchema.ts'
export type { BaseLinearDisplayConfigModel } from './models/configSchema.ts'
export { legendMixinSlots } from './models/LegendMixin.ts'
export type { ExportSvgDisplayOptions } from './types.ts'

export { default as BlockMsg } from '../shared/BlockMsg.tsx'
export type { LegendItem, LegendSection } from '@jbrowse/display-ui'
export { default as DisplayChrome } from './components/DisplayChrome.tsx'
export type { ChromeModel } from './components/DisplayChrome.tsx'
// Same chrome for a display with no rendering backend (arc's main-thread SVG):
// it supplies the phase and the first-paint flag itself. See DisplayChrome.tsx.
export { DisplayStatusChrome } from './components/DisplayChrome.tsx'
export { default as DisplayStatusChromeBase } from './components/DisplayStatusChromeBase.tsx'
export type { StatusChromeModel } from './components/DisplayChrome.tsx'
// The seam itself lives in `@jbrowse/display-ui`, which has no UI-toolkit
// dependency at all — that is the guarantee, and npm enforces it where a test
// of rendered elements could not. This plugin holds the Material bindings and
// depends on that package; nothing runs the other way.
//
// Re-exported here because every display and every embedder already names these
// from this plugin. `DisplayChromeBase` stays, being this plugin's own chrome.
export {
  DisplayChromeOverlayProvider,
  DisplayUIProvider,
  plainChromeOverlays,
} from '@jbrowse/display-ui'
export type { DisplayChromeOverlays } from '@jbrowse/display-ui'
export { default as DisplayChromeBase } from './components/DisplayChromeBase.tsx'
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
export { heightModeConfigSchemaFields } from './models/heightModeConfigSchemaFields.ts'
export { heightModeMenuItems } from './models/heightModeMenu.ts'
export type { HeightModeMenuModel } from './models/heightModeMenu.ts'

export {
  type FetchContext,
  type LoadedRegion,
  type RegionFetchContext,
  autorunOnReadyView,
  callEachRegion,
  default as MultiRegionDisplayMixin,
  fetchAllRegions,
  fetchEachRegion,
  onDisplayedRegionsChange,
} from './models/MultiRegionDisplayMixin.ts'
export {
  GlobalFetchMixin,
  type GlobalFetchAutorunHost,
  type GlobalFetchMixinType,
  type GlobalFetchPhases,
  default as GlobalDataDisplayMixin,
  installGlobalFetchAutorun,
  runGlobalFetch,
} from './models/GlobalDataDisplayMixin.ts'
export { blockKeySignature } from './models/GlobalFetchMixin.ts'
export { installPrerequisiteFetch } from './models/installPrerequisiteFetch.ts'
export {
  type FetchMixinType,
  default as FetchMixin,
  makeFetchContext,
} from './models/FetchMixin.ts'
// The phase mapping the in-tree foundations share. Only the backend-free variant
// is public: it is what an out-of-tree SVG display (arc's shape) needs, and it
// is the alternative to that display hand-writing the object literal arc used to
// — which is how arc came to be the last foundation still doing so.
export { foundationDisplayStatusPhase } from './models/foundationDisplayPhase.ts'
export type { DisplayStatusPhaseFoundation } from './models/foundationDisplayPhase.ts'
export {
  default as LegendMixin,
  gradientSvgLegendWidth,
} from './models/LegendMixin.ts'
export { squashToHeightCheckboxItem } from './models/squashToHeightMenuItem.ts'
export { computeTriangleYScalar } from './models/triangleYScalar.ts'
export {
  type TriangleTransform,
  triangleDataToScreen,
  triangleScreenToData,
} from './models/triangleTransform.ts'
export { default as TooLargeMessage } from '../shared/TooLargeMessage.tsx'
// Lives in `@jbrowse/display-ui` — six plugins render it and it reaches no UI
// toolkit. Re-exported here because that is the name they all import, and a
// removal from a plugin barrel fails quietly (PLUGIN_ABI_STABILITY.md).
export { FloatingLegend } from '@jbrowse/display-ui'
export { default as TrackHeightIndicator } from './components/TrackHeightIndicator.tsx'
export { default as BottomRightIndicators } from './components/BottomRightIndicators.tsx'
export { default as TrackControl } from './components/trackControl/TrackControl.tsx'
// The contract, its toolkit-free implementation and the menu behaviour behind
// it all live in `@jbrowse/display-ui` — see the chrome block above.
export {
  TrackControlProvider,
  plainTrackControl,
  useTrackControlMenu,
} from '@jbrowse/display-ui'
export type {
  TrackControlComponent,
  TrackControlIcon,
  TrackControlMenu,
  TrackControlOption,
  TrackControlProps,
} from '@jbrowse/display-ui'
