import type PluginManagerWithoutReExports from './PluginManagerWithoutReExports'
import type { AnyConfigurationSchemaType } from './configuration'

export default class Plugin {
  name = `${Math.random()}`

  url?: string

  version?: string

  install(_pluginManager: PluginManagerWithoutReExports): void {}

  configure(_pluginManager: PluginManagerWithoutReExports): void {}

  configurationSchema?: AnyConfigurationSchemaType
}

export type PluginConstructor = new (...args: unknown[]) => Plugin
