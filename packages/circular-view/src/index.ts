import {
  AbstractViewContainer,
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
        onClick: (session: AbstractViewContainer) => {
          session.addView('CircularView', {})
        },
      })
    }
  }
}

export { default as ChordTrack } from './ChordTrack'
