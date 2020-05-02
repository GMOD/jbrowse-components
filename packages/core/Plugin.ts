import PluginManager from './PluginManager'

export default class Plugin {
  installed = false

  configured = false

  install(pluginManager: PluginManager) {
    this.installed = true
  }

  configure(pluginManager: PluginManager) {
    this.configured = true
  }
}

export type PluginConstructor = new (...args: unknown[]) => Plugin
