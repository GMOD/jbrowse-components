import PluginManager from './PluginManager'

/**
 * base class for a JBrowse plugin
 */
export default abstract class Plugin {
  abstract name: string

  install(_pluginManager: PluginManager): void {}

  configure(_pluginManager: PluginManager): void {}
}

export type PluginConstructor = new (...args: unknown[]) => Plugin
