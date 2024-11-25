import domLoadScript from 'load-script'

// locals
import Plugin from './Plugin'
import ReExports from './ReExports'
import { isElectron } from './util'
import type { PluginConstructor } from './Plugin'

export interface UMDLocPluginDefinition {
  umdLoc: {
    uri: string
    baseUri?: string
  }
  name: string
}

export interface UMDUrlPluginDefinition {
  umdUrl: string
  name: string
}

export interface LegacyUMDPluginDefinition {
  url: string
  name: string
}

type UMDPluginDefinition = UMDLocPluginDefinition | UMDUrlPluginDefinition

export function isUMDPluginDefinition(
  def: PluginDefinition,
): def is UMDPluginDefinition | LegacyUMDPluginDefinition {
  return (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ((def as UMDUrlPluginDefinition).umdUrl !== undefined ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (def as LegacyUMDPluginDefinition).url !== undefined ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (def as UMDLocPluginDefinition).umdLoc !== undefined) &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (def as LegacyUMDPluginDefinition | UMDPluginDefinition).name !== undefined
  )
}

export interface ESMLocPluginDefinition {
  esmLoc: {
    uri: string
    baseUri?: string
  }
}
export interface ESMUrlPluginDefinition {
  esmUrl: string
}

export type ESMPluginDefinition =
  | ESMLocPluginDefinition
  | ESMUrlPluginDefinition

export function isESMPluginDefinition(
  def: PluginDefinition,
): def is ESMPluginDefinition {
  return (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (def as ESMUrlPluginDefinition).esmUrl !== undefined ||
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (def as ESMLocPluginDefinition).esmLoc !== undefined
  )
}

export interface CJSPluginDefinition {
  cjsUrl: string
}

function promisifiedLoadScript(src: string) {
  return new Promise((resolve, reject) => {
    domLoadScript(src, (err, script) => {
      if (err) {
        reject(err)
      } else {
        resolve(script.src)
      }
    })
  })
}

async function loadScript(scriptUrl: string) {
  if (!isInWebWorker()) {
    return promisifiedLoadScript(scriptUrl)
  }

  // @ts-expect-error
  if (globalThis.importScripts) {
    // @ts-expect-error
    await globalThis.importScripts(scriptUrl)
    return
  }
  throw new Error(
    'cannot figure out how to load external JS scripts in this environment',
  )
}

export function isCJSPluginDefinition(
  def: PluginDefinition,
): def is CJSPluginDefinition {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (def as CJSPluginDefinition).cjsUrl !== undefined
}

export type PluginDefinition =
  | UMDUrlPluginDefinition
  | UMDLocPluginDefinition
  | LegacyUMDPluginDefinition
  | ESMLocPluginDefinition
  | ESMUrlPluginDefinition
  | CJSPluginDefinition

export interface PluginRecord {
  plugin: PluginConstructor
  definition: PluginDefinition
}

export interface LoadedPlugin {
  default: PluginConstructor
}

export function pluginDescriptionString(pluginDefinition: PluginDefinition) {
  if (isUMDPluginDefinition(pluginDefinition)) {
    return `UMD plugin ${pluginDefinition.name}`
  }
  if (isESMPluginDefinition(pluginDefinition)) {
    return `ESM plugin ${
      (pluginDefinition as ESMUrlPluginDefinition).esmUrl ||
      (pluginDefinition as ESMLocPluginDefinition).esmLoc.uri
    }`
  }
  if (isCJSPluginDefinition(pluginDefinition)) {
    return `CJS plugin ${pluginDefinition.cjsUrl}`
  }
  return 'unknown plugin'
}

function isInWebWorker() {
  return Boolean('WorkerGlobalScope' in globalThis)
}

export default class PluginLoader {
  definitions: PluginDefinition[] = []

  fetchESM?: (url: string) => Promise<LoadedPlugin>
  fetchCJS?: (url: string) => Promise<LoadedPlugin>

  constructor(
    defs: PluginDefinition[] = [],
    args?: {
      fetchESM?: (url: string) => Promise<LoadedPlugin>
      fetchCJS?: (url: string) => Promise<LoadedPlugin>
    },
  ) {
    this.fetchESM = args?.fetchESM
    this.fetchCJS = args?.fetchCJS
    this.definitions = JSON.parse(JSON.stringify(defs))
  }

  async loadCJSPlugin(def: CJSPluginDefinition, baseUri?: string) {
    const parsedUrl = new URL(def.cjsUrl, baseUri)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `Cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    if (!this.fetchCJS) {
      throw new Error('No fetchCJS callback provided')
    }

    return this.fetchCJS(parsedUrl.href)
  }

  async loadESMPlugin(def: ESMPluginDefinition, baseUri?: string) {
    const parsedUrl =
      'esmUrl' in def
        ? new URL(def.esmUrl, baseUri)
        : new URL(def.esmLoc.uri, def.esmLoc.baseUri)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }

    if (!this.fetchESM) {
      throw new Error('No ESM fetcher installed')
    }
    const plugin = await this.fetchESM(parsedUrl.href)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!plugin) {
      throw new Error(`Could not load ESM plugin: ${parsedUrl}`)
    }
    return plugin
  }

  async loadUMDPlugin(
    def: UMDPluginDefinition | LegacyUMDPluginDefinition,
    baseUri?: string,
  ) {
    const parsedUrl =
      'url' in def
        ? new URL(def.url, baseUri)
        : 'umdUrl' in def
          ? new URL(def.umdUrl, baseUri)
          : new URL(def.umdLoc.uri, def.umdLoc.baseUri)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    const moduleName = def.name
    const umdName = `JBrowsePlugin${moduleName}`
    if (typeof jest === 'undefined') {
      await loadScript(parsedUrl.href)
    } else {
      // @ts-expect-error
      globalThis[umdName] = { default: Plugin }
    }

    // @ts-expect-error
    const plugin = globalThis[umdName] as
      | { default: PluginConstructor }
      | undefined
    if (!plugin) {
      throw new Error(
        `Failed to load UMD bundle for ${moduleName}, ${umdName} is undefined`,
      )
    }
    return plugin
  }

  async loadPlugin(def: PluginDefinition, baseUri?: string) {
    let plugin: LoadedPlugin
    if (isElectron && isCJSPluginDefinition(def)) {
      plugin = await this.loadCJSPlugin(def, baseUri)
    } else if (isESMPluginDefinition(def)) {
      plugin = await this.loadESMPlugin(def, baseUri)
    } else if (isUMDPluginDefinition(def)) {
      plugin = await this.loadUMDPlugin(def, baseUri)
    } else if (!isElectron && isCJSPluginDefinition(def)) {
      throw new Error(
        `CommonJS plugin found, but not in a NodeJS environment: ${JSON.stringify(
          def,
        )}`,
      )
    } else {
      throw new Error(`Could not determine plugin type: ${JSON.stringify(def)}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!plugin.default) {
      throw new Error(
        `${pluginDescriptionString(
          def,
        )} does not have a default export, cannot load`,
      )
    }
    return plugin.default
  }

  installGlobalReExports(target: WindowOrWorkerGlobalScope) {
    // @ts-expect-error
    target.JBrowseExports = Object.fromEntries(
      Object.entries(ReExports).map(([moduleName, module]) => {
        return [moduleName, module]
      }),
    )
    return this
  }

  async load(baseUri?: string) {
    return Promise.all(
      this.definitions.map(async definition => ({
        plugin: await this.loadPlugin(definition, baseUri),
        definition,
      })),
    )
  }
}
