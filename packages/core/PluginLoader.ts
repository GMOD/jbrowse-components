import domLoadScript from 'load-script2'

// locals
import Plugin, { PluginConstructor } from './Plugin'
import ReExports from './ReExports'
import { isElectron } from './util'

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
    ((def as UMDUrlPluginDefinition).umdUrl !== undefined ||
      (def as LegacyUMDPluginDefinition).url !== undefined ||
      (def as UMDLocPluginDefinition).umdLoc !== undefined) &&
    (def as LegacyUMDPluginDefinition | UMDPluginDefinition).name !== undefined
  )
}

export interface ESMLocPluginDefinition {
  esmLoc: { uri: string; baseUri?: string }
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
    (def as ESMUrlPluginDefinition).esmUrl !== undefined ||
    (def as ESMLocPluginDefinition).esmLoc !== undefined
  )
}

export interface CJSPluginDefinition {
  cjsUrl: string
}

export function isCJSPluginDefinition(
  def: PluginDefinition,
): def is CJSPluginDefinition {
  return (def as CJSPluginDefinition).cjsUrl !== undefined
}

export interface PluginDefinition
  extends Partial<UMDUrlPluginDefinition>,
    Partial<UMDLocPluginDefinition>,
    Partial<LegacyUMDPluginDefinition>,
    Partial<ESMLocPluginDefinition>,
    Partial<ESMUrlPluginDefinition>,
    Partial<CJSPluginDefinition> {}

export interface PluginRecord {
  plugin: PluginConstructor
  definition: PluginDefinition
}

export interface LoadedPlugin {
  default: PluginConstructor
}

function pluginDescriptionString(pluginDefinition: PluginDefinition) {
  if (isUMDPluginDefinition(pluginDefinition)) {
    return `UMD plugin ${pluginDefinition.name}`
  }
  if (isESMPluginDefinition(pluginDefinition)) {
    return `ESM plugin ${
      (pluginDefinition as ESMUrlPluginDefinition).esmUrl ||
      (pluginDefinition as ESMLocPluginDefinition).esmLoc?.uri
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

  async loadScript(scriptUrl: string) {
    if (!isInWebWorker()) {
      return domLoadScript(scriptUrl)
    }

    // @ts-expect-error
    if (globalThis?.importScripts) {
      // @ts-expect-error
      await globalThis.importScripts(scriptUrl)
      return
    }
    throw new Error(
      'cannot figure out how to load external JS scripts in this environment',
    )
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
      throw new Error(`No ESM fetcher installed`)
    }
    const plugin = await this.fetchESM(parsedUrl.href)

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
      await this.loadScript(parsedUrl.href)
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
