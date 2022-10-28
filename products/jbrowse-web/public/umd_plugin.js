/* eslint-disable no-restricted-globals */
// we put the code in a function to avoid variable name collisions with the
// global scope
;(function () {
  class Plugin {
    name = 'UMDUrlPlugin'
    version = '1.0'

    install(/* pluginManager */) {}

    configure(/* pluginManager */) {}
  }

  // the plugin will be included in both the main thread and web worker, so
  // install plugin to either window or self (webworker global scope)
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginUMDUrlPlugin = {
    default: Plugin,
  }
})()
