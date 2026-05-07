/* globals self,window */
// we put the code in a function to avoid variable name collisions with the
// global scope
;(function () {
  class UrlPlugin {
    name = 'UMDUrlPlugin'
    version = '1.0'

    install(/* pluginManager */) {}

    configure(/* pluginManager */) {}
  }

  class LocPlugin {
    name = 'UMDLocPlugin'
    version = '1.0'

    install(/* pluginManager */) {}

    configure(/* pluginManager */) {}
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  const scope = typeof self !== 'undefined' ? self : window
  scope.JBrowsePluginUMDUrlPlugin = {
    default: UrlPlugin,
  }
  scope.JBrowsePluginUMDLocPlugin = {
    default: LocPlugin,
  }
})()
