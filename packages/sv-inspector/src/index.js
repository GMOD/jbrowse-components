export default class SvInspectorViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SvInspectorView/SvInspectorViewType')),
    )
  }

  configure() {
    // nothing
  }
}
