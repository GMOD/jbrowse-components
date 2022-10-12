function MyComponent() {
  return 'Hello world'
}

class HexPlugin {
  install(pluginManager) {
    // pluginManager.addToExtensionPoint('Core-replaceAbout', (args, context) => {
    //   console.log({ args, context })
    //   return MyComponent
    // })
  }
  configure() {}
}

console.log('uuu')

window.JBrowsePluginHexPlugin = { default: HexPlugin }
self.JBrowsePluginHexPlugin = { default: HexPlugin }
