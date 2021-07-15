import PluginManager from './PluginManager'
import { AnyConfigurationSchemaType } from './configuration/configurationSchema'

/**
 * base class for a JBrowse plugin
 */
export default abstract class Plugin {
  abstract name: string

  url?: string

  version?: string

  install(_pluginManager: PluginManager): void {}

  configure(_pluginManager: PluginManager): void {}

  configurationSchema: AnyConfigurationSchemaType | undefined = undefined
}

export type PluginConstructor = new (...args: unknown[]) => Plugin
