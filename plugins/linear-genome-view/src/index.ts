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
      defaultValue: 'overlapping',
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
} from './BaseLinearDisplay/index.ts'

export {
  BaseLinearDisplayComponent,
  BlockMsg,
  ConfigOverrideMixin,
  DisplayChrome,
  DisplayErrorBar,
  DisplayLoadingOverlay,
  FloatingLegend,
  GlobalDataDisplayMixin,
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  RegionTooLargeMixin,
  StaleViewportRescaleMixin,
  TOO_MANY_FEATURES_REASON,
  TooLargeMessage,
  TrackHeightMixin,
  autorunOnReadyView,
  baseLinearDisplayConfigSchema,
  bytesTooLargeReason,
  computeRenderTransform,
  drawCanvasImageData,
  evaluateRegionTooLarge,
  fetchAllRegions,
  fetchEachRegion,
  getDisplayStr,
  migrateOldSettingSnapshots,
  onDisplayedRegionsChange,
  resolveByteLimit,
} from './BaseLinearDisplay/index.ts'
export type {
  ByteEstimateConfig,
  FetchContext,
  GlobalDataDisplayMixinType,
  MultiRegionDisplayMixinType,
  RegionTooLargeStatus,
  RenderTransform,
  RenderTransformInputs,
  StaleViewportRescaleMixinType,
} from './BaseLinearDisplay/index.ts'
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
export type { LaunchLinearGenomeViewArgs } from './LaunchLinearGenomeView/index.ts'
export type {
  BpOffset,
  ExportSvgOptions,
  HighlightType,
  InitState,
  NavLocation,
  TrackInit,
  TrackLabelMode,
  VolatileGuide,
} from './LinearGenomeView/types.ts'
export {
  SVGGridlines,
  SVGRuler,
  SVGTracks,
  renderToSvg,
} from './LinearGenomeView/svgcomponents/SVGLinearGenomeView.tsx'
export { default as SVGHighlights } from './LinearGenomeView/svgcomponents/SVGHighlights.tsx'
export { default as ExportSvgDialog } from './LinearGenomeView/components/ExportSvgDialog.tsx'
export { SVGErrorBox, SvgClipRect } from '@jbrowse/core/svg/SvgExport'
export { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
export type { SvgExportable } from '@jbrowse/core/svg/svgReady'
export {
  totalHeight,
  trackBoxHeight,
} from './LinearGenomeView/svgcomponents/util.ts'
