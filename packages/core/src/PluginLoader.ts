import Plugin from './Plugin.ts'
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

export function pluginDescriptionString(d: PluginDefinition) {
  if (isUMDPluginDefinition(d)) {
    return `UMD plugin ${d.name}`
  } else if (isESMPluginDefinition(d)) {
    return `ESM plugin ${
      (d as ESMUrlPluginDefinition).esmUrl ||
      (d as ESMLocPluginDefinition).esmLoc.uri
    }`
  } else if (isCJSPluginDefinition(d)) {
    return `CJS plugin ${d.cjsUrl}`
  } else {
    return 'unknown plugin'
  }
}
export function pluginUrl(d: PluginDefinition) {
  if (isUMDPluginDefinition(d)) {
    if ('url' in d) {
      return d.url
    }
    if ('umdUrl' in d) {
      return d.umdUrl
    }
    return d.umdLoc.uri
  } else if (isESMPluginDefinition(d)) {
    if ('esmUrl' in d) {
      return d.esmUrl
    }
    return d.esmLoc.uri
  } else if (isCJSPluginDefinition(d)) {
    return d.cjsUrl
  } else {
    return 'unknown url'
  }
}

export function pluginDefinitionMetadata(definition: PluginDefinition) {
  return {
    name: 'name' in definition ? definition.name : undefined,
    url: pluginUrl(definition),
  }
}

export function pluginLabel(definition: PluginDefinition) {
  const name = 'name' in definition ? definition.name : undefined
  const url = pluginUrl(definition)
  if (name) {
    return `${name} (${url})`
  }
  return url
}

export function dedupePlugins(plugins: PluginDefinition[]) {
  const seenNames = new Set<string>()
  const seenUrls = new Set<string>()
  const result: PluginDefinition[] = []
  for (const plugin of plugins) {
    const name = 'name' in plugin ? plugin.name : undefined
    const url = pluginUrl(plugin)
    if (name && seenNames.has(name)) {
      continue
    }
    if (url !== 'unknown url' && seenUrls.has(url)) {
      continue
    }
    if (name) {
      seenNames.add(name)
    }
    if (url !== 'unknown url') {
      seenUrls.add(url)
    }
    result.push(plugin)
  }
  return result
}

function isInWebWorker() {
  return 'WorkerGlobalScope' in globalThis
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

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error(
        `cannot load plugins using protocol "${parsedUrl.protocol}"`,
      )
    }
    const moduleName = def.name
    const umdName = `JBrowsePlugin${moduleName}`
    if (typeof jest === 'undefined') {
      await loadScript(addCacheBuster(parsedUrl.href))
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
    target.JBrowseExports = ReExports
    return this
  }

  async load(baseUri?: string) {
    const results = await Promise.allSettled(
      this.definitions.map(async definition => ({
        plugin: await this.loadPlugin(definition, baseUri),
        definition,
      })),
    )
    const loaded = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        loaded.push(result.value)
      } else {
        console.error('Failed to load plugin:', result.reason)
      }
    }
    return loaded
  }
}
