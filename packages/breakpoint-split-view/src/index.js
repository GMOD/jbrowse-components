export default class BreakpointSplitViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./BreakpointSplitView')),
    )
  }

  configure() {}
}
