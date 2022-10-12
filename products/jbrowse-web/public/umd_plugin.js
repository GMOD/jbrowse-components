function MyComponent() {
  return 'Hello world'
}

class MyClass2 {
  name = 'UMDUrlPlugin'
  install(pluginManager) {}
  configure() {}
}

// the plugin will be included in both the main thread and web worker, so
// install plugin to either window or self (webworker global scope)
;(typeof self !== 'undefined' ? self : window).JBrowsePluginUMDUrlPlugin = {
  default: MyClass2,
}
