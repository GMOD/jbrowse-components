function MyComponent() {
  return 'Hello world'
}

export default class {
  install(pluginManager) {
    // pluginManager.addToExtensionPoint('Core-replaceAbout', (args, context) => {
    //   console.log({ args, context })
    //   return MyComponent
    // })
  }
  configure() {}
}
