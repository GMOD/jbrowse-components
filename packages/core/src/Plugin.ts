import type PluginManager from './PluginManager.ts'
import type { AnyConfigurationSchemaType } from './configuration/index.ts'

/**
 * base class for a JBrowse plugin
 */
export default abstract class Plugin {
  abstract name: string

  url?: string

  version?: string

  install(_pluginManager: PluginManager): void {}

  configure(_pluginManager: PluginManager): void {}

  // this is put into configuration.YourPluginName.configSlot
  configurationSchema?: AnyConfigurationSchemaType

  // this is put into configuration.configSlot
  configurationSchemaUnnamespaced?: AnyConfigurationSchemaType

  // this is spread into the root config, just configSlot
  rootConfigurationSchema?: (
    arg: PluginManager,
  ) => Record<string, AnyConfigurationSchemaType>
}

export type PluginConstructor = new (...args: unknown[]) => Plugin
