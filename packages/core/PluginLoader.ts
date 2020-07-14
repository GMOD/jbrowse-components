/* eslint-disable no-restricted-globals */
import url from 'url'
import domLoadScript from 'load-script2'

import { PluginConstructor } from './Plugin'
import { ConfigurationSchema } from './configuration'

export const PluginSourceConfigurationSchema = ConfigurationSchema(
  'PluginSource',
  {
    name: {
      type: 'string',
      defaultValue: '',
    },
    url: {
      type: 'string',
      defaultValue: '',
    },
  },
)

export interface PluginDefinition {
  name?: string
  url: string
}

export default class PluginLoader {
  definitions: PluginDefinition[] = []

  constructor(pluginDefinitions: PluginDefinition[] = []) {
    this.definitions = JSON.parse(JSON.stringify(pluginDefinitions))
  }

  async loadScript(scriptUrl: string): Promise<void> {
    if (document && document.getElementsByTagName) {
      return domLoadScript(scriptUrl)
    }
    // @ts-ignore
    if (self && self.importScripts) {
      // @ts-ignore
      self.importScripts(scriptUrl)
      return undefined
    }
    throw new Error(
      'cannot figure out how to load external JS scripts in this environment',
    )
  }

  async loadPlugin(definition: PluginDefinition): Promise<PluginConstructor> {
    const parsedUrl = url.parse(definition.url)
    if (!parsedUrl.protocol)
      throw new TypeError(`invalid plugin url '${definition.url}'`)
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      await this.loadScript(definition.url)
      const moduleName =
        definition.name || this.moduleNameFromParsedUrl(parsedUrl)
      const umdName = `JBrowsePlugin${moduleName}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugin = (window as any)[umdName] as { default: PluginConstructor }
      if (!plugin)
        throw new Error(
          `plugin ${moduleName} failed to load, window.${umdName} is undefined`,
        )
      return plugin.default
    }
    throw new Error(`cannot load plugins using from ${parsedUrl.protocol}`)
  }

  moduleNameFromParsedUrl(parsedUrl: url.UrlWithStringQuery): string {
    return 'fogbat'
  }

  async load(): Promise<PluginConstructor[]> {
    return Promise.all(
      this.definitions.map(definition => this.loadPlugin(definition)),
    )
  }
}
