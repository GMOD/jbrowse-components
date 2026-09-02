import { enableContractReports } from '@jbrowse/render-core/contractReports'

import { setReExportRegistry } from './ReExports/registry.ts'
import {
  isCJSPluginDefinition,
  isESMPluginDefinition,
  isUMDPluginDefinition,
  maybePluginUrl,
  pluginDescriptionString,
} from './pluginDefinitions.ts'
import { isElectron } from './util/index.ts'
import { isWebWorker } from './util/isWebWorker.ts'

import type { PluginConstructor } from './Plugin.ts'
import type {
  CJSPluginDefinition,
  ESMPluginDefinition,
  LegacyUMDPluginDefinition,
  PluginDefinition,
  UMDPluginDefinition,
} from './pluginDefinitions.ts'

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

// What a definition *is* — its types, guards, url/name accessors, and
// same-plugin comparison — lives in pluginDefinitions.ts, which stays free of
// the ReExports graph this module pulls in. Import from there to inspect a
// definition; import here to run one.

export interface PluginRecord {
  plugin: PluginConstructor
  definition: PluginDefinition
}

export interface LoadedPlugin {
  default: PluginConstructor
}

/** A definition that could not be loaded, kept with the reason it failed */
export interface PluginLoadFailure {
  definition: PluginDefinition
  error: unknown
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

// A *module* worker has importScripts on its global but throws from it — the
// spec forbids it there, and the browser says so ("Module scripts don't support
// importScripts"). That is the whole failure for a UMD plugin in a bundler
// configured for module workers (Vite's `worker.format: 'es'`), and it reads as
// a broken plugin unless named. Every other throw is the script's own — a 404,
// or a bundle that dereferences `window` in a realm that has none — and the
// script's words are the diagnosis, so they are kept rather than replaced.
export function workerScriptLoadMessage(scriptUrl: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  return /module script/i.test(detail)
    ? `Failed to load ${scriptUrl} in the worker. A UMD plugin is loaded there via importScripts, which module workers do not support — either build the worker as a classic worker, or use a plugin published as ESM.`
    : `Failed to load ${scriptUrl} in the worker: ${detail}`
}

async function loadScript(scriptUrl: string, integrity?: string) {
  const scope = globalThis
  if (!isWebWorker()) {
    return promisifiedLoadScript(scriptUrl, integrity)
  } else if (hasImportScripts(scope)) {
    try {
      scope.importScripts(scriptUrl)
    } catch (error) {
      throw new Error(workerScriptLoadMessage(scriptUrl, error), {
        cause: error,
      })
    }
    return
  } else {
    throw new Error(
      'cannot figure out how to load external JS scripts in this environment',
    )
  }
}

/**
 * Resolve a plugin's url, refusing anything that isn't http(s).
 *
 * `base` is the JBrowse **instance's** own location, not the config that named
 * the plugin — every product passes `window.location.href` (the embedded ones
 * let their host override it, the RPC worker forwards the same value). That is
 * deliberate rather than an oversight: a relative url means "a plugin shipped
 * beside this index.html". A config that means "beside *me*" has the
 * `umdLoc`/`esmLoc` forms instead, which carry their own `baseUri` — the one
 * `addRelativeUris` stamps from the config's url when it is fetched.
 *
 * The rule only bites on Desktop, whose instance is a `file://` page, so a
 * relative url resolves to a `file:` url that could never be fetched. Diagnose
 * that in terms its author can act on: the raw scheme of a url they never wrote
 * ("Cannot load plugins using protocol file:") named the symptom and nothing
 * else, and the reader is usually looking at a third-party hub config.
 */
function resolvePluginUrl(spec: string, base?: string) {
  const url = new URL(spec, base)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      // a spec with a scheme of its own resolved to exactly what it asked for,
      // so there is nothing to explain beyond refusing it
      /^[a-z][a-z0-9+.-]*:/i.test(spec)
        ? `Cannot load plugins using protocol "${url.protocol}"`
        : `Cannot load plugin from relative url "${spec}": it resolves against this JBrowse instance (${base}), not against the config that named it. Give it an absolute http(s) url, or use the umdLoc/esmLoc form to resolve it against the config.`,
    )
  }
  return url
}

// A plugin served from the developer's own machine into an app built for
// production is the one arrangement that can only be a plugin under
// development: a shipped site serves its plugins from its own origin, and a
// developer running the app itself from source already has a development build.
// So it is the evidence that arms the contract channel without anything for the
// author to know about first — which is the whole difficulty the channel had,
// since the population it is written for is the one with nobody to ask. See
// `@jbrowse/render-core/contractReports`.
function armIfUnderDevelopment(def: PluginDefinition) {
  const url = maybePluginUrl(def)
  if (url !== undefined && servedFromThisMachine(url)) {
    enableContractReports(`the plugin at ${url} is served from this machine`)
  }
}

function servedFromThisMachine(url: string) {
  try {
    const { hostname, protocol } = new URL(url)
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]')
    )
  } catch {
    // a relative url is a plugin shipped beside this index.html, which is the
    // site's own rather than one under development
    return false
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
    const parsedUrl = resolvePluginUrl(def.cjsUrl, baseUri)
    if (!this.fetchCJS) {
      throw new Error('No fetchCJS callback provided')
    }
    return this.fetchCJS(parsedUrl.href)
  }

  async loadESMPlugin(def: ESMPluginDefinition, baseUri?: string) {
    const parsedUrl =
      'esmUrl' in def
        ? resolvePluginUrl(def.esmUrl, baseUri)
        : resolvePluginUrl(def.esmLoc.uri, def.esmLoc.baseUri)
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
        ? resolvePluginUrl(def.url, baseUri)
        : 'umdUrl' in def
          ? resolvePluginUrl(def.umdUrl, baseUri)
          : resolvePluginUrl(def.umdLoc.uri, def.umdLoc.baseUri)

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
    armIfUnderDevelopment(def)
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

  private reExportTarget: WindowOrWorkerGlobalScope | undefined

  /**
   * Ask for the runtime ABI (`JBrowseExports`) to be published on `target`
   * before any plugin bundle is evaluated. Records the target; the registry
   * itself is fetched in `loadSettled` below.
   *
   * The split is the point. Every product calls this at startup, synchronously,
   * whether or not the config names a plugin — so importing the registry here
   * put it in every host's first paint. It is a ~126 KB gzipped module (see
   * `ReExports/registry.ts` for why it cannot shrink) that only a runtime plugin
   * can use, and loading one is async anyway.
   */
  installGlobalReExports(target: WindowOrWorkerGlobalScope) {
    this.reExportTarget = target
    return this
  }

  private async publishReExports() {
    const target = this.reExportTarget
    // only a runtime plugin can call jbrequire, and the registry names React,
    // react-dom/client and Material UI: a realm with no definitions must not
    // fetch that stack to serve nobody
    if (!target || this.definitions.length === 0) {
      return
    }
    const { default: ReExports } = await import('./ReExports/index.ts')
    ;(target as unknown as Record<string, unknown>).JBrowseExports = {
      ...ReExports,
    }
    // the synchronous half: `pluginManager.jbrequire(name)` is what a CJS
    // plugin calls, and it cannot await
    setReExportRegistry(ReExports)
    this.reExportTarget = undefined
  }

  /**
   * Loads every definition and separates the ones that worked from the ones
   * that didn't, instead of failing the batch on the first error.
   *
   * A remote config names its plugins at urls nobody re-checks — a store path
   * that stops being republished, a bundle that needs a newer host than the one
   * reading the config — and `load`'s all-or-nothing contract turns any of that
   * into a dead app rather than a missing feature. That is the widest blast
   * radius left in config loading: an unknown track/adapter/display type is
   * already tolerated (the track is simply not usable), so the plugin url was
   * the only field in a config that could still take a whole session down.
   *
   * Callers that can degrade (the apps) use this and report the failures;
   * callers that cannot (the RPC worker, where a half-loaded plugin set would
   * fail renders with a much worse message) keep using `load`.
   */
  async loadSettled(baseUri?: string) {
    // before the first plugin script evaluates — a UMD bundle reads
    // `JBrowseExports` off the global at module scope
    await this.publishReExports()
    const results = await Promise.allSettled(
      this.definitions.map(async definition => ({
        plugin: await this.loadPlugin(definition, baseUri),
        definition,
      })),
    )
    const records: PluginRecord[] = []
    const failures: PluginLoadFailure[] = []
    for (const [i, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        records.push(result.value)
      } else {
        failures.push({
          definition: this.definitions[i]!,
          error: result.reason,
        })
      }
    }
    return { records, failures }
  }

  async load(baseUri?: string) {
    const { records, failures } = await this.loadSettled(baseUri)
    // rethrown by definition order rather than by which rejected first, so the
    // error a strict caller sees doesn't depend on network timing
    if (failures[0]) {
      throw failures[0].error
    }
    return records
  }
}
