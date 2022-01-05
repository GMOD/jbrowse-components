/* global __non_webpack_require__ */
import domLoadScript from 'load-script2'
import sanitize from 'sanitize-filename'

import { PluginConstructor } from './Plugin'
import { ConfigurationSchema } from './configuration'

import ReExports from './ReExports'
import { isElectron } from './util'

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

export interface UMDPluginDefinition {
  umdUrl: string
  name: string
}

export interface LegacyUMDPluginDefinition {
  url: string
  name: string
}

export function isUMDPluginDefinition(
  pluginDefinition: PluginDefinition,
): pluginDefinition is UMDPluginDefinition | LegacyUMDPluginDefinition {
  return (
    ((pluginDefinition as UMDPluginDefinition).umdUrl !== undefined ||
      (pluginDefinition as LegacyUMDPluginDefinition).url !== undefined) &&
    (pluginDefinition as LegacyUMDPluginDefinition | UMDPluginDefinition)
      .name !== undefined
  )
}

export interface ESMPluginDefinition {
  esmUrl: string
}

export function isESMPluginDefinition(
  pluginDefinition: PluginDefinition,
): pluginDefinition is ESMPluginDefinition {
  return (pluginDefinition as ESMPluginDefinition).esmUrl !== undefined
}

export interface CJSPluginDefinition {
  cjsUrl: string
}

export function isCJSPluginDefinition(
  pluginDefinition: PluginDefinition,
): pluginDefinition is CJSPluginDefinition {
  return (pluginDefinition as CJSPluginDefinition).cjsUrl !== undefined
}

export interface PluginDefinition
  extends Partial<UMDPluginDefinition>,
    Partial<LegacyUMDPluginDefinition>,
    Partial<ESMPluginDefinition>,
    Partial<CJSPluginDefinition> {}

export interface PluginRecord {
  plugin: PluginConstructor
  definition: PluginDefinition
}

export interface LoadedPlugin {
  default: PluginConstructor
}

function getGlobalObject(): Window {
  // Based on window-or-global
  // https://github.com/purposeindustries/window-or-global/blob/322abc71de0010c9e5d9d0729df40959e1ef8775/lib/index.js
  return (
    /* eslint-disable-next-line no-restricted-globals */
    (typeof self === 'object' && self.self === self && self) ||
    (typeof global === 'object' && global.global === global && global) ||
    // @ts-ignore
    this
  )
}

function isInWebWorker(globalObject: ReturnType<typeof getGlobalObject>) {
  return Boolean('WorkerGlobalScope' in globalObject)
}

export default class PluginLoader {
  definitions: PluginDefinition[] = []

  constructor(pluginDefinitions: PluginDefinition[] = []) {
    this.definitions = JSON.parse(JSON.stringify(pluginDefinitions))
  }

  loadScript(scriptUrl: string): Promise<void> {
    const globalObject = getGlobalObject()
    if (!isInWebWorker(globalObject)) {
      return domLoadScript(scriptUrl)
    }

    // @ts-ignore
    if (globalObject && globalObject.importScripts) {
      return new Promise((resolve, reject) => {
        try {
          // @ts-ignore
          globalObject.importScripts(scriptUrl)
        } catch (error) {
          reject(error || new Error(`failed to load ${scriptUrl}`))
          return
        }
        resolve()
      })
    }
    throw new Error(
      'cannot figure out how to load external JS scripts in this environment',
    )
  }

  async loadCJSPlugin(
    pluginDefinition: CJSPluginDefinition,
  ): Promise<LoadedPlugin> {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(
        pluginDefinition.cjsUrl,
        getGlobalObject().location.href,
      )
    } catch (error) {
      console.error(error)
      throw new Error(`Error parsing URL: ${pluginDefinition.cjsUrl}`)
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    const fs: typeof import('fs') = require('fs')
    const path: typeof import('path') = require('path')
    const os: typeof import('os') = require('os')
    const http: typeof import('http') = require('http')
    const fsPromises = fs.promises
    // On macOS `os.tmpdir()` returns the path to a symlink, see:
    // https://github.com/nodejs/node/issues/11422
    const systemTmp = await fsPromises.realpath(os.tmpdir())
    const tmpDir = await fsPromises.mkdtemp(
      path.join(systemTmp, 'jbrowse-plugin-'),
    )
    let plugin: LoadedPlugin | undefined = undefined
    try {
      const pluginLocation = path.join(tmpDir, sanitize(parsedUrl.href))
      const pluginLocationRelative = path.relative('.', pluginLocation)

      const pluginDownload = new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(pluginLocation)
        http
          .get(parsedUrl.href, response => {
            response.pipe(file)
            file.on('finish', () => {
              resolve()
            })
          })
          .on('error', err => {
            fs.unlinkSync(pluginLocation)
            reject(err)
          })
      })
      await pluginDownload
      plugin = __non_webpack_require__(pluginLocationRelative) as
        | LoadedPlugin
        | undefined
    } finally {
      fsPromises.rmdir(tmpDir, { recursive: true })
    }

    if (!plugin) {
      throw new Error(`Could not load CJS plugin: ${parsedUrl}`)
    }
    return plugin
  }

  async loadESMPlugin(pluginDefinition: ESMPluginDefinition) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(
        pluginDefinition.esmUrl,
        getGlobalObject().location.href,
      )
    } catch (error) {
      console.error(error)
      throw new Error(`Error parsing URL: ${pluginDefinition.esmUrl}`)
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    const plugin = (await import(/* webpackIgnore: true */ parsedUrl.href)) as
      | LoadedPlugin
      | undefined
    if (!plugin) {
      throw new Error(`Could not load ESM plugin: ${parsedUrl}`)
    }
    return plugin
  }

  async loadUMDPlugin(
    pluginDefinition: UMDPluginDefinition | LegacyUMDPluginDefinition,
  ) {
    const umdUrl =
      'url' in pluginDefinition ? pluginDefinition.url : pluginDefinition.umdUrl
    let parsedUrl: URL
    try {
      parsedUrl = new URL(umdUrl, getGlobalObject().location.href)
    } catch (error) {
      console.error(error)
      throw new Error(`Error parsing URL: ${umdUrl}`)
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    await this.loadScript(parsedUrl.href)
    const moduleName = pluginDefinition.name
    const umdName = `JBrowsePlugin${moduleName}`
    const globalObject = getGlobalObject()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = (globalObject as any)[umdName] as
      | { default: PluginConstructor }
      | undefined
    if (!plugin) {
      throw new Error(
        `Failed to load UMD bundle for ${moduleName}, ${globalObject.constructor.name}.${umdName} is undefined`,
      )
    }
    return plugin
  }

  async loadPlugin(definition: PluginDefinition): Promise<PluginConstructor> {
    let plugin: LoadedPlugin
    if (isElectron && isCJSPluginDefinition(definition)) {
      plugin = await this.loadCJSPlugin(definition)
    } else if (isESMPluginDefinition(definition)) {
      plugin = await this.loadESMPlugin(definition)
    } else if (isUMDPluginDefinition(definition)) {
      plugin = await this.loadUMDPlugin(definition)
    } else if (!isElectron && isCJSPluginDefinition(definition)) {
      throw new Error(
        `Only CommonJS plugin found, but not in a NodeJS environment: ${JSON.stringify(
          definition,
        )}`,
      )
    } else {
      throw new Error(
        `Could not determine plugin type: ${JSON.stringify(definition)}`,
      )
    }
    return plugin.default
  }

  installGlobalReExports(target: WindowOrWorkerGlobalScope) {
    // @ts-ignore
    target.JBrowseExports = Object.fromEntries(
      Object.entries(ReExports).map(([moduleName, module]) => {
        return [moduleName, module]
      }),
    )
  }

  async load() {
    return Promise.all(
      this.definitions.map(
        async definition =>
          ({
            plugin: await this.loadPlugin(definition),
            definition,
          } as PluginRecord),
      ),
    )
  }
}
