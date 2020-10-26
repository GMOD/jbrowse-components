import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import DataUsageIcon from '@material-ui/icons/DataUsage'
import CircularViewFactory from './CircularView'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(CircularViewFactory),
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

export { default as ChordTrack } from './ChordTrack'

export { default as ChordTrackLoadingFactory } from './ChordTrack/components/Loading'
export { default as ChordTrackErrorFactory } from './ChordTrack/components/TrackError'
export { default as ChordTrackModelFactory } from './ChordTrack/models/ChordTrack'
