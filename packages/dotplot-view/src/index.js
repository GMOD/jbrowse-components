import Plugin from '@gmod/jbrowse-core/Plugin'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./DotplotView')),
    )
  }
}
