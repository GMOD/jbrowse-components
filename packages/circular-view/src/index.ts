import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@gmod/jbrowse-core/util'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'
import DataUsageIcon from '@material-ui/icons/DataUsage'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./CircularView')),
    )

    pluginManager.addTrackType(() =>
      pluginManager.jbrequire(require('./StructuralVariantChordTrack')),
    )

    pluginManager.addRendererType(() =>
      pluginManager.jbrequire(require('./StructuralVariantChordRenderer')),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Circular view',
        icon: DataUsageIcon,
        onClick: (session: AbstractSessionModel) => {
          if ('addView' in session) {
            session.addView('CircularView', {})
          } else {
            session.notify('Adding views not supported')
          }
        },
      })
    }
  }
}

export { default as ChordTrack } from './ChordTrack'
