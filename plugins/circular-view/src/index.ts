import { lazy } from 'react'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import DataUsageIcon from '@material-ui/icons/DataUsage'
import stateModelFactory from './CircularView/models/CircularView'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          ReactComponent: lazy(
            () => import('./CircularView/components/CircularView'),
          ),
          stateModel: stateModelFactory(pluginManager),
          name: 'CircularView',
        }),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Circular view',
        icon: DataUsageIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('CircularView', {})
        },
      })
    }
  }
}

export {
  BaseChordDisplayModel,
  baseChordDisplayConfig,
  BaseChordDisplayComponentFactory,
} from './BaseChordDisplay'
