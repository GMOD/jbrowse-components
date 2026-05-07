import ReExports from './ReExports/index.ts'
import { isElectron } from './util/index.ts'

import type { PluginConstructor } from './Plugin.ts'

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
  return 'umdUrl' in def || 'url' in def || 'umdLoc' in def
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
  return 'esmUrl' in def || 'esmLoc' in def
}

export interface CJSPluginDefinition {
  cjsUrl: string
}

function promisifiedLoadScript(src: string) {
  return new Promise<string>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = src
    script.onload = () => {
      resolve(script.src)
    }
    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`))
    }
    document.head.append(script)
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
  return 'cjsUrl' in def
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

export function pluginDescriptionString(d: PluginDefinition) {
  if (isUMDPluginDefinition(d)) {
    return `UMD plugin ${d.name}`
  } else if (isESMPluginDefinition(d)) {
    return `ESM plugin ${'esmUrl' in d ? d.esmUrl : d.esmLoc.uri}`
  } else if (isCJSPluginDefinition(d)) {
    return `CJS plugin ${d.cjsUrl}`
  } else {
    return 'unknown plugin'
  }
}
export function pluginUrl(d: PluginDefinition) {
  if (isUMDPluginDefinition(d)) {
    return 'umdLoc' in d ? d.umdLoc.uri : 'umdUrl' in d ? d.umdUrl : d.url
  } else if (isESMPluginDefinition(d)) {
    return 'esmUrl' in d ? d.esmUrl : d.esmLoc.uri
  } else if (isCJSPluginDefinition(d)) {
    return d.cjsUrl
  } else {
    return 'unknown url'
  }
}

function isInWebWorker() {
  return 'WorkerGlobalScope' in globalThis
}

function assertHttpProtocol(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Cannot load plugins using protocol "${url.protocol}"`)
  }
}

function addCacheBuster(url: string) {
  // @ts-expect-error
  if (!globalThis.__jbrowseCacheBuster) {
    return url
  }
  const u = new URL(url)
  u.searchParams.set('_cb', Date.now().toString())
  return u.href
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
    this.definitions = structuredClone(defs)
  }

  async loadCJSPlugin(def: CJSPluginDefinition, baseUri?: string) {
    const parsedUrl = new URL(def.cjsUrl, baseUri)
    assertHttpProtocol(parsedUrl)
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
    assertHttpProtocol(parsedUrl)
    if (!this.fetchESM) {
      throw new Error('No ESM fetcher installed')
    }
    const plugin = await this.fetchESM(addCacheBuster(parsedUrl.href))
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

    assertHttpProtocol(parsedUrl)
    const moduleName = def.name
    const umdName = `JBrowsePlugin${moduleName}`
    await loadScript(addCacheBuster(parsedUrl.href))

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
    if (isCJSPluginDefinition(def)) {
      if (!isElectron) {
        throw new Error(
          `CommonJS plugin found, but not in a NodeJS environment: ${JSON.stringify(def)}`,
        )
      }
      plugin = await this.loadCJSPlugin(def, baseUri)
    } else if (isESMPluginDefinition(def)) {
      plugin = await this.loadESMPlugin(def, baseUri)
    } else if (isUMDPluginDefinition(def)) {
      plugin = await this.loadUMDPlugin(def, baseUri)
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
    target.JBrowseExports = { ...ReExports }
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
