import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

// icons
import LineStyleIcon from '@mui/icons-material/LineStyle'

import {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  BlockModel,
  baseLinearDisplayConfigSchema,
} from './BaseLinearDisplay'
import LinearBareDisplayF, {
  configSchemaFactory as linearBareDisplayConfigSchemaFactory,
} from './LinearBareDisplay'
import LinearGenomeViewF, {
  renderToSvg,
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
  RefNameAutocomplete,
  SearchBox,
  ZoomControls,
  LinearGenomeView,
} from './LinearGenomeView'
import LinearBasicDisplayF, {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay'

import FeatureTrackF from './FeatureTrack'
import BasicTrackF from './BasicTrack'
import LaunchLinearGenomeViewF from './LaunchLinearGenomeView'

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

export {
  baseLinearDisplayConfigSchema,
  linearBareDisplayConfigSchemaFactory,
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayModelFactory,
  renderToSvg,
  BaseLinearDisplayComponent,
  BaseLinearDisplay,
  RefNameAutocomplete,
  SearchBox,
}

export type { LinearGenomeViewModel, LinearGenomeViewStateModel, BlockModel }

export type { BaseLinearDisplayModel } from './BaseLinearDisplay'
