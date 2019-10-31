export default class BreakpointSplitViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./BreakpointSplitView')),
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  configure() {}
}
