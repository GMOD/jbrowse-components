import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import LineStyleIcon from '@mui/icons-material/LineStyle'
import { types } from 'mobx-state-tree'

// icons

// locals
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
  SearchBox,
  ZoomControls,
  LinearGenomeView,
} from './LinearGenomeView'

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
  ExportSvgDisplayOptions,
  BaseLinearDisplayModel,
  BlockModel,
} from './BaseLinearDisplay'

export { configSchemaFactory as linearBareDisplayConfigSchemaFactory } from './LinearBareDisplay'
export {
  baseLinearDisplayConfigSchema,
  BaseLinearDisplay,
  BlockMsg,
  BaseLinearDisplayComponent,
  TrackHeightMixin,
  FeatureDensityMixin,
  TooLargeMessage,
} from './BaseLinearDisplay'
export {
  type LinearGenomeViewModel,
  type LinearGenomeViewStateModel,
  RefNameAutocomplete,
  SearchBox,
} from './LinearGenomeView'
export {
  renderToSvg,
  SVGTracks,
  SVGRuler,
} from './LinearGenomeView/svgcomponents/SVGLinearGenomeView'
export { totalHeight } from './LinearGenomeView/svgcomponents/util'
export {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay'
