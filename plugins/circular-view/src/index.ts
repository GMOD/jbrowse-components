import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@gmod/jbrowse-core/util'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'
import DataUsageIcon from '@material-ui/icons/DataUsage'
import CircularViewFactory from './CircularView'
import StructuralVariantChordRendererFactory from './StructuralVariantChordRenderer'
import StructuralVariantChordTrackFactory from './StructuralVariantChordTrack'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(CircularViewFactory),
    )

    pluginManager.addTrackType(() =>
      pluginManager.jbrequire(StructuralVariantChordTrackFactory),
    )

    pluginManager.addRendererType(() =>
      pluginManager.jbrequire(StructuralVariantChordRendererFactory),
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
