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
import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
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
    LinearBasicDisplayF(pluginManager)
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
  FloatingLabelData,
  LayoutFeatureMetadata,
  LegendItem,
} from './BaseLinearDisplay/index.ts'

export {
  configSchemaFactory as linearBareDisplayConfigSchemaFactory,
  stateModelFactory as linearBareDisplayStateModelFactory,
} from './LinearBareDisplay/index.ts'
export {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  BlockMsg,
  FeatureDensityMixin,
  FloatingLegend,
  MultiRegionWebGLDisplayMixin,
  NonBlockCanvasDisplayComponent,
  NonBlockCanvasDisplayMixin,
  SVGLegend,
  TooLargeMessage,
  TrackHeightMixin,
  baseLinearDisplayConfigSchema,
  calculateSvgLegendWidth,
  createSubfeatureLabelMetadata,
  drawCanvasImageData,
} from './BaseLinearDisplay/index.ts'
export type {
  MultiRegionWebGLDisplayMixinType,
  MultiRegionWebGLRegion,
  NonBlockCanvasDisplayMixinType,
  NonBlockCanvasDisplayModel,
} from './BaseLinearDisplay/index.ts'
export {
  type LinearGenomeViewModel,
  type LinearGenomeViewStateModel,
  RefNameAutocomplete,
  SearchBox,
} from './LinearGenomeView/index.ts'
export { fetchResults } from './searchUtils.ts'
export type {
  BpOffset,
  ExportSvgOptions,
  HighlightType,
  InitState,
  NavLocation,
  VolatileGuide,
} from './LinearGenomeView/types.ts'
export {
  SVGGridlines,
  SVGRuler,
  SVGTracks,
  renderToSvg,
} from './LinearGenomeView/svgcomponents/SVGLinearGenomeView.tsx'
export { totalHeight } from './LinearGenomeView/svgcomponents/util.ts'
export {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay/index.ts'
export {
  configSchema as linearFeatureDisplayConfigSchemaFactory,
  modelFactory as linearFeatureDisplayModelFactory,
} from './LinearFeatureDisplay/index.ts'
export type {
  LinearFeatureDisplayModel,
  LinearFeatureDisplayStateModel,
} from './LinearFeatureDisplay/index.ts'
export { default as LinearBasicDisplayComponent } from './LinearBasicDisplay/components/LinearBasicDisplayComponent.tsx'
