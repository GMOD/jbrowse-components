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

  configure() {}
}

export { default as ChordTrack } from './ChordTrack'
