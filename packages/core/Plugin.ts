import type PluginManager from './PluginManager'
import type { AnyConfigurationSchemaType } from './configuration'

/**
 * base class for a JBrowse plugin
 */
export default abstract class Plugin {
  abstract name: string

  url?: string

  version?: string

  install(_pluginManager: PluginManager): void {}

  configure(_pluginManager: PluginManager): void {}

  configurationSchema?: AnyConfigurationSchemaType
}

export type PluginConstructor = new (...args: unknown[]) => Plugin
