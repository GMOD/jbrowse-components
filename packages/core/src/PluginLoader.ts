import { enableContractReports } from '@jbrowse/render-core/contractReports'

import {
  loudOnMissingModule,
  setReExportRegistry,
} from './ReExports/registry.ts'
import {
  isESMPluginDefinition,
  isUMDPluginDefinition,
  maybePluginUrl,
  pluginDescriptionString,
  pluginLabel,
} from './pluginDefinitions.ts'
import { isWebWorker } from './util/isWebWorker.ts'

import type { PluginConstructor } from './Plugin.ts'
import type {
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
/**
 * A `cjsUrl` definition loaded by writing the bundle to a temp file and
 * `require`ing it in Electron's renderer, which is the one loader that needed
 * Node. Electron's renderer runs ESM, and a plugin reaching the main process
 * does it through `window.require('electron')` whatever format it ships in, so
 * the format bought nothing its two peers do not. Name its successor rather
 * than letting the definition fall through to "could not determine plugin
 * type", which reads as a malformed config.
 */
function assertRetiredKinds(def: PluginDefinition) {
  if ('cjsUrl' in def) {
    throw new Error(
      `CJS plugins are no longer loaded (${String(def.cjsUrl)}). Publish the plugin as UMD or ESM and name it with umdUrl or esmUrl.`,
    )
  }
}

function assertSingleKind(def: PluginDefinition) {
  const kinds = [
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

export type ReExportRegistryLoader = () => Promise<{
  default: Record<string, unknown>
}>

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

const workerPrefetches = new Map<string, Promise<void>>()

/**
 * `importScripts` blocks until its file arrives, so a worker loading its
 * plugins with it waited one round trip per plugin, in a row. Fetching them all
 * first makes each `importScripts` a cache read — provided the fetch is the
 * request `importScripts` makes: no-cors, with credentials. Chrome and Firefox
 * both re-download for any other mode (probe-worker-script-cache.ts).
 */
function prefetchWorkerScript(url: string) {
  if (!workerPrefetches.has(url)) {
    workerPrefetches.set(
      url,
      fetch(url, { mode: 'no-cors', credentials: 'include' })
        .then(r => r.arrayBuffer())
        .then(
          () => {},
          () => {},
        ),
    )
  }
}

async function loadScript(scriptUrl: string, integrity?: string) {
  const scope = globalThis
  if (!isWebWorker()) {
    return promisifiedLoadScript(scriptUrl, integrity)
  } else if (hasImportScripts(scope)) {
    await workerPrefetches.get(scriptUrl)
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

function umdPluginUrl(
  def: UMDPluginDefinition | LegacyUMDPluginDefinition,
  baseUri?: string,
) {
  return 'url' in def
    ? resolvePluginUrl(def.url, baseUri)
    : 'umdUrl' in def
      ? resolvePluginUrl(def.umdUrl, baseUri)
      : resolvePluginUrl(def.umdLoc.uri, def.umdLoc.baseUri)
}

/**
 * The registry has to be published before a plugin bundle runs, but not before
 * it downloads, so each bundle is preloaded while the registry is fetched.
 * Skipped under the cache-buster, whose query string differs per request.
 *
 * Exported for a worker told its plugins ahead of its boot configuration.
 */
export function preloadUMDBundles(defs: PluginDefinition[], baseUri?: string) {
  if ('__jbrowseCacheBuster' in globalThis) {
    return
  }
  if (isWebWorker()) {
    for (const def of defs) {
      if (isUMDPluginDefinition(def)) {
        try {
          prefetchWorkerScript(umdPluginUrl(def, baseUri).href)
        } catch {
          // loadPlugin reports a url it cannot resolve
        }
      }
    }
    return
  }
  if (typeof document === 'undefined') {
    return
  }
  for (const def of defs) {
    if (isUMDPluginDefinition(def)) {
      try {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'script'
        if (def.integrity) {
          link.setAttribute('integrity', def.integrity)
          link.setAttribute('crossorigin', 'anonymous')
        }
        link.href = umdPluginUrl(def, baseUri).href
        document.head.append(link)
      } catch {
        // loadPlugin reports a url it cannot resolve
      }
    }
  }
}

export default class PluginLoader {
  definitions: PluginDefinition[] = []

  fetchESM?: (url: string) => Promise<LoadedPlugin>

  constructor(
    defs: PluginDefinition[] = [],
    args?: {
      fetchESM?: (url: string) => Promise<LoadedPlugin>
    },
  ) {
    this.fetchESM = args?.fetchESM
    this.definitions = structuredClone(defs)
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
    const parsedUrl = umdPluginUrl(def, baseUri)

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
    assertRetiredKinds(def)
    assertSingleKind(def)
    armIfUnderDevelopment(def)
    let plugin: LoadedPlugin
    if (isESMPluginDefinition(def)) {
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

  private reExports:
    | { target: WindowOrWorkerGlobalScope; registry: ReExportRegistryLoader }
    | undefined

  /**
   * Ask for the runtime ABI (`JBrowseExports`) to be published on `target`
   * before any plugin bundle is evaluated. Records the target and the loader;
   * `loadSettled` fetches the registry, a ~126 KB gzipped module only a runtime
   * plugin can use (see `ReExports/registry.ts` for why it cannot shrink).
   *
   * `registry` is the product's generated map — `reExports.generated.ts` on
   * the main thread, `workerReExports.generated.ts` in its worker — which
   * serves every `@jbrowse` package the product bundles. The caller names it
   * because the registry serves this module: an `import()` of it from here is
   * a cycle rolldown keeps in any host bundling this file, whether or not
   * anything loads a plugin (EAGER_BUNDLE.md §3).
   */
  installGlobalReExports(
    target: WindowOrWorkerGlobalScope,
    registry: ReExportRegistryLoader,
  ) {
    this.reExports = { target, registry }
    return this
  }

  private async publishReExports() {
    if (!this.reExports) {
      return
    }
    const { target, registry } = this.reExports
    const { default: ReExports } = await registry()
    ;(target as unknown as Record<string, unknown>).JBrowseExports =
      loudOnMissingModule({ ...ReExports })
    // the synchronous half: `pluginManager.jbrequire(name)` is what a CJS
    // plugin calls, and it cannot await
    setReExportRegistry(ReExports)
    this.reExports = undefined
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
    preloadUMDBundles(this.definitions, baseUri)
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
    // error a strict caller sees doesn't depend on network timing.
    //
    // Named, because the RPC worker calls this: a plugin that throws while
    // evaluating takes the whole RpcServer with it, and the bare error is
    // whatever the bundle's module scope said — `Cannot read properties of
    // undefined`, or the missing ABI key — with nothing saying which plugin
    // read it. The message is carried rather than the error, since this one
    // crosses postMessage and `serializeError` cannot clone an arbitrary
    // `cause`.
    const failure = failures[0]
    if (failure) {
      const { definition, error } = failure
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`plugin ${pluginLabel(definition)} failed: ${detail}`)
    }
    return records
  }
}
