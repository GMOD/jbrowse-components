import domLoadScript from 'load-script2'

import { PluginConstructor } from './Plugin'
import ReExports from './ReExports'
import { isElectron } from './util'

export interface UMDLocPluginDefinition {
  umdLoc: { uri: string; baseUri?: string }
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

export function getWindowPath(windowHref: string) {
  return window.location.href + windowHref
}

function getGlobalObject(): Window {
  // Based on window-or-global
  // https://github.com/purposeindustries/window-or-global/blob/322abc71de0010c9e5d9d0729df40959e1ef8775/lib/index.js
  return (
    // eslint-disable-next-line no-restricted-globals
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

  fetchESM?: (url: string) => Promise<unknown>
  fetchCJS?: (url: string) => Promise<LoadedPlugin>

  constructor(
    defs: PluginDefinition[] = [],
    args?: {
      fetchESM?: (url: string) => Promise<unknown>
      fetchCJS?: (url: string) => Promise<LoadedPlugin>
    },
  ) {
    this.fetchESM = args?.fetchESM
    this.fetchCJS = args?.fetchCJS
    this.definitions = JSON.parse(JSON.stringify(defs))
  }

  async loadScript(scriptUrl: string): Promise<void> {
    const globalObject = getGlobalObject()
    if (!isInWebWorker(globalObject)) {
      return domLoadScript(scriptUrl)
    }

    // @ts-ignore
    if (globalObject?.importScripts) {
      // @ts-ignore
      await globalObject.importScripts(scriptUrl)
      return
    }
    throw new Error(
      'cannot figure out how to load external JS scripts in this environment',
    )
  }

  async loadCJSPlugin(def: CJSPluginDefinition, windowHref: string) {
    const parsedUrl = new URL(def.cjsUrl, windowHref)
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

  async loadESMPlugin(def: ESMPluginDefinition, windowHref: string) {
    const parsedUrl =
      'esmUrl' in def
        ? new URL(def.esmUrl, windowHref)
        : new URL(def.esmLoc.uri, def.esmLoc.baseUri)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    const plugin = (await this.fetchESM?.(parsedUrl.href)) as
      | LoadedPlugin
      | undefined

    if (!plugin) {
      throw new Error(`Could not load ESM plugin: ${parsedUrl}`)
    }
    return plugin
  }

  async loadUMDPlugin(
    def: UMDPluginDefinition | LegacyUMDPluginDefinition,
    windowHref: string,
  ) {
    const parsedUrl =
      'url' in def
        ? new URL(def.url, windowHref)
        : 'umdUrl' in def
        ? new URL(def.umdUrl, windowHref)
        : new URL(def.umdLoc.uri, def.umdLoc.baseUri)

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    await this.loadScript(parsedUrl.href)
    const moduleName = def.name
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

  async loadPlugin(def: PluginDefinition, windowHref: string) {
    let plugin: LoadedPlugin
    if (isElectron && isCJSPluginDefinition(def)) {
      plugin = await this.loadCJSPlugin(def, windowHref)
    } else if (isESMPluginDefinition(def)) {
      plugin = await this.loadESMPlugin(def, windowHref)
    } else if (isUMDPluginDefinition(def)) {
      plugin = await this.loadUMDPlugin(def, windowHref)
    } else if (!isElectron && isCJSPluginDefinition(def)) {
      throw new Error(
        `CommonJS plugin found, but not in a NodeJS environment: ${JSON.stringify(
          def,
        )}`,
      )
    } else {
      throw new Error(`Could not determine plugin type: ${JSON.stringify(def)}`)
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

  async load(windowHref = '') {
    return Promise.all(
      this.definitions.map(async definition => ({
        plugin: await this.loadPlugin(definition, windowHref),
        definition,
      })),
    )
  }
}
