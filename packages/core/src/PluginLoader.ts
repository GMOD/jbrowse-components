import ReExports from './ReExports/index.ts'
import { isElectron } from './util/index.ts'

import type { PluginConstructor } from './Plugin.ts'

export interface UMDLocPluginDefinition {
  umdLoc: {
    uri: string
    baseUri?: string
  }
  name: string
  integrity?: string
}

export interface UMDUrlPluginDefinition {
  umdUrl: string
  name: string
  integrity?: string
}

export interface LegacyUMDPluginDefinition {
  url: string
  name: string
  integrity?: string
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
  name?: string
}
export interface ESMUrlPluginDefinition {
  esmUrl: string
  name?: string
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
  name?: string
}

function promisifiedLoadScript(src: string, integrity?: string) {
  return new Promise<string>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    // Subresource integrity guarantees the fetched bytes match the hash the
    // plugin store published, so a tampered or swapped artifact fails to load.
    // crossOrigin is required for the browser to enforce integrity on a
    // cross-origin script.
    if (integrity) {
      script.integrity = integrity
      script.crossOrigin = 'anonymous'
    }
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

function hasImportScripts(
  scope: typeof globalThis,
): scope is typeof globalThis & { importScripts: (url: string) => void } {
  return 'importScripts' in scope
}

async function loadScript(scriptUrl: string, integrity?: string) {
  const scope = globalThis
  if (!isInWebWorker()) {
    return promisifiedLoadScript(scriptUrl, integrity)
  } else if (hasImportScripts(scope)) {
    scope.importScripts(scriptUrl)
    return
  } else {
    throw new Error(
      'cannot figure out how to load external JS scripts in this environment',
    )
  }
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

// Plugins that used to ship as external config `plugins[]` entries but are now
// bundled into the jbrowse-web/desktop core build. Remote configs on jbrowse.org
// still list them, so we drop those entries before loading: core already
// registers the same elements (and wins, since core plugins register first), and
// skipping the external copy avoids a redundant network fetch plus a flurry of
// "already registered" console warnings. Matched on the config-level `name`
// (the external plugin's UMD-global name, e.g. "MafViewer"/"GWAS"), not the core
// class name. Apply only in products whose core bundle actually vendors these —
// not globally — so CLI indexing, @jbrowse/img, and react-circular (which don't
// bundle them) still load the external plugin. Also drives the plugin store,
// which hides these so a user can't install a colliding second copy.
export const vendoredPluginNames = new Set(['MafViewer', 'GWAS'])

export function dropVendoredPlugins(defs: PluginDefinition[]) {
  return defs.filter(
    d => !(isUMDPluginDefinition(d) && vendoredPluginNames.has(d.name)),
  )
}

export interface PluginRecord {
  plugin: PluginConstructor
  definition: PluginDefinition
}

export interface LoadedPlugin {
  default: PluginConstructor
}

// The two functions below describe a definition by picking the one url it will
// be loaded from, so both dispatch in loadPlugin's order — CJS, then ESM, then
// UMD. Keep them in step with it: they are what the plugin trust gate
// (checkPlugins) reads and what the untrusted-plugin prompt shows, so an order
// that disagrees with the loader's vets one url and executes another. They once
// did disagree, and a definition carrying both `umdUrl` and `cjsUrl` was
// approved on its jbrowse.org umd url while loadPlugin require()d its cjs one.
// assertSingleKind now rejects such a definition outright; this order is the
// second half of that guarantee, since the gate runs before the loader does.
export function pluginDescriptionString(d: PluginDefinition) {
  if (isCJSPluginDefinition(d)) {
    return `CJS plugin ${d.cjsUrl}`
  } else if (isESMPluginDefinition(d)) {
    return `ESM plugin ${'esmUrl' in d ? d.esmUrl : d.esmLoc.uri}`
  } else if (isUMDPluginDefinition(d)) {
    return `UMD plugin ${d.name}`
  } else {
    return 'unknown plugin'
  }
}
export function pluginUrl(d: PluginDefinition) {
  if (isCJSPluginDefinition(d)) {
    return d.cjsUrl
  } else if (isESMPluginDefinition(d)) {
    return 'esmUrl' in d ? d.esmUrl : d.esmLoc.uri
  } else if (isUMDPluginDefinition(d)) {
    return 'umdLoc' in d ? d.umdLoc.uri : 'umdUrl' in d ? d.umdUrl : d.url
  } else {
    return 'unknown url'
  }
}

/**
 * A definition names exactly one loader. More than one is malformed — no real
 * config declares a plugin twice — and it is the shape that lets "the url we
 * vetted" and "the url we run" drift apart, so refuse it rather than pick a
 * winner. That keeps them the same string by construction, instead of by every
 * url-based inspection of a definition remembering to match loadPlugin's order.
 */
function assertSingleKind(def: PluginDefinition) {
  const kinds = [
    isCJSPluginDefinition(def) ? 'CJS' : undefined,
    isESMPluginDefinition(def) ? 'ESM' : undefined,
    isUMDPluginDefinition(def) ? 'UMD' : undefined,
  ].filter(kind => kind !== undefined)
  if (kinds.length > 1) {
    throw new Error(
      `Plugin definition names more than one plugin type (${kinds.join(', ')}), refusing to load: ${JSON.stringify(def)}`,
    )
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
  if (!('__jbrowseCacheBuster' in globalThis)) {
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
    // a cache buster query string would change the bytes the browser hashes for
    // SRI, so skip it when an integrity hash is present (the url is already
    // version-pinned and immutable, so cache-busting is unnecessary anyway)
    await loadScript(
      def.integrity ? parsedUrl.href : addCacheBuster(parsedUrl.href),
      def.integrity,
    )

    const plugin = (globalThis as Record<string, unknown>)[umdName] as
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
    assertSingleKind(def)
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
    ;(target as unknown as Record<string, unknown>).JBrowseExports = {
      ...ReExports,
    }
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
