import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import LineStyleIcon from '@mui/icons-material/LineStyle'

import {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
} from './BaseLinearDisplay/index.ts'
import BasicTrackF from './BasicTrack/index.ts'
import FeatureTrackF from './FeatureTrack/index.ts'
import LaunchLinearGenomeViewF from './LaunchLinearGenomeView/index.ts'
import LinearBareDisplayF from './LinearBareDisplay/index.ts'
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
    BaseLinearDisplay,
    baseLinearDisplayConfigSchema,
    SearchBox,
    ZoomControls,
    LinearGenomeView,
  }

  /**
   * #config LinearGenomeViewConfigSchema
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
    BasicTrackF(pluginManager)
    LinearGenomeViewF(pluginManager)
    LinearBareDisplayF(pluginManager)
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
  BaseLinearDisplayModel,
  BlockModel,
  ExportSvgDisplayOptions,
  FeatureLabelData,
  FloatingLabelData,
  LayoutFeatureMetadata,
  LayoutRecord,
  LegendItem,
  RenderedProps,
} from './BaseLinearDisplay/index.ts'

export {
  configSchemaFactory as linearBareDisplayConfigSchemaFactory,
  stateModelFactory as linearBareDisplayStateModelFactory,
} from './LinearBareDisplay/index.ts'
export {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  BlockMsg,
  ConfigOverrideMixin,
  DisplayChrome,
  DisplayErrorBar,
  DisplayLoadingOverlay,
  FeatureDensityMixin,
  FloatingLegend,
  GlobalDataDisplayMixin,
  MultiRegionDisplayMixin,
  SVGLegend,
  StaleViewportRescaleMixin,
  TooLargeMessage,
  TrackHeightMixin,
  baseLinearDisplayConfigSchema,
  calculateSvgLegendWidth,
  computeRenderTransform,
  createSubfeatureLabelMetadata,
  drawCanvasImageData,
  getDisplayStr,
  migrateOldSettingSnapshots,
  onDisplayedRegionsChange,
} from './BaseLinearDisplay/index.ts'
export type {
  ByteEstimateConfig,
  FetchContext,
  GlobalDataDisplayMixinType,
  MultiRegionDisplayMixinType,
  RenderTransform,
  RenderTransformInputs,
  StaleViewportRescaleMixinType,
} from './BaseLinearDisplay/index.ts'
export {
  AUTO_FORCE_LOAD_BP,
  HighlightBand,
  type LinearGenomeViewModel,
  type LinearGenomeViewStateModel,
  OverviewHighlightBand,
  RefNameAutocomplete,
  SearchBox,
} from './LinearGenomeView/index.ts'
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
export { SVGErrorBox, SvgClipRect } from '@jbrowse/core/util/svgExport'
export { totalHeight } from './LinearGenomeView/svgcomponents/util.ts'
