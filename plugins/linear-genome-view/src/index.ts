import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import LineStyleIcon from '@mui/icons-material/LineStyle'

import {
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
} from './BaseLinearDisplay/index.ts'
import FeatureTrackF from './FeatureTrack/index.ts'
import LaunchLinearGenomeViewF from './LaunchLinearGenomeView/index.ts'
import ZoomControls from './LinearGenomeView/components/HeaderZoomControls.tsx'
import SequenceFeatureHoverHighlightExtensionF from './LinearGenomeView/components/SequenceFeatureHoverHighlightExtension.tsx'
import LinearGenomeViewF, {
  LinearGenomeView,
  SearchBox,
} from './LinearGenomeView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class LinearGenomeViewPlugin extends Plugin {
  name = 'LinearGenomeViewPlugin'

  exports = {
    BaseLinearDisplayComponent,
    baseLinearDisplayConfigSchema,
    SearchBox,
    ZoomControls,
    LinearGenomeView,
  }

  /**
   * #config LinearGenomeViewConfigSchema
   * #category root
   */
  configurationSchema = ConfigurationSchema('LinearGenomeViewConfigSchema', {
    /**
     * #slot configuration.LinearGenomeViewPlugin.trackLabels
     */
    trackLabels: {
      type: 'string',
      defaultValue: 'offset',
      model: types.enumeration('trackLabelOptions', [
        'offset',
        'overlapping',
        'hidden',
      ]),
    },
  })

  install(pluginManager: PluginManager) {
    FeatureTrackF(pluginManager)
    LinearGenomeViewF(pluginManager)
    LaunchLinearGenomeViewF(pluginManager)
    SequenceFeatureHoverHighlightExtensionF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Linear genome view',
        icon: LineStyleIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearGenomeView', {})
        },
      })
    }
  }
}

export type {
  ExportSvgDisplayOptions,
  LayoutRecord,
  LegendItem,
  LegendSection,
  LinearDisplayModel,
} from './BaseLinearDisplay/index.ts'

export {
  BaseLinearDisplayComponent,
  BlockMsg,
  DisplayChrome,
  DisplayErrorBar,
  DisplayLoadingOverlay,
  FetchMixin,
  FloatingLegend,
  GROW_MAX_HEIGHT,
  GlobalDataDisplayMixin,
  GlobalFetchMixin,
  HEIGHT_MODE_VALUES,
  HeightModeMixin,
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  PromotableDefaultsMixin,
  RegionTooLargeMixin,
  StaleViewportRescaleMixin,
  TOO_MANY_FEATURES_REASON,
  TooLargeMessage,
  TrackHeightIndicator,
  TrackHeightMixin,
  autorunOnReadyView,
  baseLinearDisplayConfigSchema,
  bytesTooLargeReason,
  checkByteEstimate,
  computeRenderTransform,
  computeTriangleYScalar,
  drawCanvasImageData,
  evaluateRegionTooLarge,
  fetchAllRegions,
  fetchEachRegion,
  getDisplayStr,
  getHeightModeOptions,
  getTrackSizingMenuItem,
  heightModeMenuItems,
  installGlobalFetchAutorun,
  installGrowExitBake,
  onDisplayedRegionsChange,
  raiseLimitPast,
  resolveByteLimit,
  scaleByteEstimate,
  scaledForceLoadByteLimit,
  viewportMatchesLastDrawn,
} from './BaseLinearDisplay/index.ts'
export type {
  ByteEstimateConfig,
  FetchContext,
  GlobalDataDisplayMixinType,
  HeightMode,
  HeightModeMenuModel,
  MultiRegionDisplayMixinType,
  RegionTooLargeStatus,
  RenderTransform,
  RenderTransformInputs,
  StaleViewportRescaleMixinType,
} from './BaseLinearDisplay/index.ts'
// re-exported so LGV plugins that host their own (non-GPU) chrome can share the
// single terminal-state precedence instead of re-encoding it (arc's SVG chrome)
export { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'
export type {
  DisplayPhase,
  DisplayPhaseInputs,
} from '@jbrowse/render-core/displayPhase'
export {
  AUTO_FORCE_LOAD_BP,
  HighlightBand,
  HighlightChip,
  type LinearGenomeViewModel,
  type LinearGenomeViewStateModel,
  OverviewHighlightBand,
  SVGHighlightBand,
  SearchBox,
  type SyncableViewAction,
  installLinkedViewSync,
  stateModelFactory as linearGenomeViewStateModelFactory,
} from './LinearGenomeView/index.ts'
export {
  MultiLevelRubberband,
  type MultiLevelRubberbandModel,
} from './MultiLevelRubberband/index.ts'
export { fetchResults } from './searchUtils.ts'
export { normalizeTrackInit } from './LinearGenomeView/normalizeTrackInit.ts'
export type { LaunchLinearGenomeViewArgs } from './LaunchLinearGenomeView/index.ts'
export type {
  BpOffset,
  ExportRCodeOptions,
  ExportSvgOptions,
  HighlightType,
  InitState,
  NavLocation,
  RTrackFragment,
  TrackInit,
  TrackLabelMode,
  VolatileGuide,
} from './LinearGenomeView/types.ts'
export {
  SVGGridlines,
  SVGRuler,
  SVGTracks,
  SVGView,
  renderToSvg,
} from './LinearGenomeView/svgcomponents/SVGLinearGenomeView.tsx'
export { assembleRScript } from './LinearGenomeView/exportR.ts'
export { default as SVGHighlights } from './LinearGenomeView/svgcomponents/SVGHighlights.tsx'
export { default as ExportSvgDialog } from './LinearGenomeView/components/ExportSvgDialog.tsx'
export { default as ConnectedHoverHighlight } from './LinearGenomeView/components/ConnectedHoverHighlight.tsx'
export { default as HoverPositionHighlight } from './LinearGenomeView/components/HoverPositionHighlight.tsx'
export { TrackOverlayContext } from './LinearGenomeView/TrackOverlayContext.ts'
export { TrackOverlayPortal } from './LinearGenomeView/TrackOverlayPortal.tsx'
export { FloatingSvgOverlay } from './LinearGenomeView/FloatingSvgOverlay.tsx'
export type { HoverHighlightPosition } from './LinearGenomeView/components/HoverPositionHighlight.tsx'
export {
  SVGErrorBox,
  SvgChrome,
  SvgClipRect,
} from '@jbrowse/core/svg/SvgExport'
export { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
export type { SvgExportable } from '@jbrowse/core/svg/svgReady'
export {
  totalHeight,
  trackBoxHeight,
} from './LinearGenomeView/svgcomponents/util.ts'
