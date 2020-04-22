export default class CircularViewPlugin {
  install(pluginManager) {
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

  configure(pluginManager) {
    if (pluginManager.rootModel && pluginManager.rootModel.menus) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Circular view',
        icon: 'data_usage',
        onClick: session => {
          session.addView('CircularView', {})
        },
      })
    }
  }
}

export { default as ChordTrack } from './ChordTrack'
