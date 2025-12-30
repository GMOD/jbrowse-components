import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import LineStyleIcon from '@mui/icons-material/LineStyle'

import {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
} from './BaseLinearDisplay'
import BasicTrackF from './BasicTrack'
import FeatureTrackF from './FeatureTrack'
import LaunchLinearGenomeViewF from './LaunchLinearGenomeView'
import LinearBareDisplayF from './LinearBareDisplay'
import LinearBasicDisplayF from './LinearBasicDisplay'
import LinearGenomeViewF, {
  LinearGenomeView,
  SearchBox,
} from './LinearGenomeView'
import ZoomControls from './LinearGenomeView/components/HeaderZoomControls'

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
  LegendItem,
} from './BaseLinearDisplay'

export {
  configSchemaFactory as linearBareDisplayConfigSchemaFactory,
  stateModelFactory as linearBareDisplayStateModelFactory,
} from './LinearBareDisplay'
export {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  BlockMsg,
  FeatureDensityMixin,
  FloatingLegend,
  NonBlockCanvasDisplayComponent,
  NonBlockCanvasDisplayMixin,
  SVGLegend,
  TooLargeMessage,
  TrackHeightMixin,
  baseLinearDisplayConfigSchema,
  calculateSvgLegendWidth,
  drawCanvasImageData,
} from './BaseLinearDisplay'
export type {
  NonBlockCanvasDisplayMixinType,
  NonBlockCanvasDisplayModel,
} from './BaseLinearDisplay'
export {
  type LinearGenomeViewModel,
  type LinearGenomeViewStateModel,
  RefNameAutocomplete,
  SearchBox,
} from './LinearGenomeView'
export {
  SVGGridlines,
  SVGRuler,
  SVGTracks,
  renderToSvg,
} from './LinearGenomeView/svgcomponents/SVGLinearGenomeView'
export { totalHeight } from './LinearGenomeView/svgcomponents/util'
export {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay'
export {
  configSchema as linearFeatureDisplayConfigSchemaFactory,
  modelFactory as linearFeatureDisplayModelFactory,
} from './LinearFeatureDisplay'
export type {
  LinearFeatureDisplayModel,
  LinearFeatureDisplayStateModel,
} from './LinearFeatureDisplay'
export { default as LinearBasicDisplayComponent } from './LinearBasicDisplay/components/LinearBasicDisplayComponent'
