import PluginManager from '../PluginManager'

export default (pluginManager: PluginManager) => {
  // TODO: configuration for TextManager
  // TODO: instantiate adapters
  // TODO: plugin Manager
  //  tracks will have search adapters
  return class TextSearchManager {
    constructor() {
      this.name = 'text search manager test'
    }

    parseText(searchText: string) {
      return searchText
    }
  }
}
