import { enableContractReports } from '@jbrowse/render-core/contractReports'

import { reExportKeysRead } from './ReExports/reExportKeysRead.ts'
import {
  getReExportRegistry,
  isReExportRegistryComplete,
  loudOnMissingModule,
  setReExportRegistry,
} from './ReExports/registry.ts'
import {
  isESMPluginDefinition,
  isUMDPluginDefinition,
  maybePluginUrl,
  pluginDescriptionString,
  pluginLabel,
  pluginUrlSource,
} from './pluginDefinitions.ts'
import { isWebWorker } from './util/isWebWorker.ts'

import type { PluginConstructor } from './Plugin.ts'
import type { ReExportLoaders } from './ReExports/registry.ts'
import type {
  ESMPluginDefinition,
  LegacyUMDPluginDefinition,
  PluginDefinition,
  PluginLoadFailure,
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
    isESMPluginDefinition(def) ? 'ESM' : undefined,
    isUMDPluginDefinition(def) ? 'UMD' : undefined,
  ].filter(kind => kind !== undefined)
  if (kinds.length > 1) {
    throw new Error(
      `Plugin definition names more than one plugin type (${kinds.join(', ')}), refusing to load: ${JSON.stringify(def)}`,
    )
  }
}

/**
 * A `cjsUrl` definition loaded by writing the bundle to a temp file and
 * `require`ing it in Electron's renderer, the one loader that needed Node. That
 * renderer runs UMD and ESM, and a plugin reaching the main process does it
 * through `window.require('electron')` whatever format it ships in, so the
 * format bought nothing its two peers do not. Name the successor rather than
 * letting the definition fall through to "could not determine plugin type",
 * which reads as a malformed config.
 */
function assertRetiredKinds(def: PluginDefinition) {
  if ('cjsUrl' in def) {
    throw new Error(
      `CJS plugins are no longer loaded (${String(def.cjsUrl)}). Publish the plugin as UMD or ESM and name it with umdUrl or esmUrl.`,
    )
  }
}

// What a definition *is* — its types, guards, url/name accessors, and
// same-plugin comparison — lives in pluginDefinitions.ts, which stays free of
// the ReExports graph this module pulls in. Import from there to inspect a
// definition; import here to run one.

export type { PluginLoadFailure } from './pluginDefinitions.ts'

export interface PluginRecord {
  plugin: PluginConstructor
  definition: PluginDefinition
}

export type ReExportRegistryLoader = () => Promise<{
  default: Record<string, unknown>
}>

export type ReExportLoadersLoader = () => Promise<{
  default: ReExportLoaders
}>

export interface LoadedPlugin {
  default: PluginConstructor
}

function promisifiedLoadScript(
  src: string,
  integrity?: string,
  cors?: boolean,
) {
  return new Promise<string>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    // Subresource integrity guarantees the fetched bytes match the hash the
    // plugin store published, so a tampered or swapped artifact fails to load.
    // crossOrigin is required for the browser to enforce integrity on a
    // cross-origin script. It is also what makes the script a cache read after
    // the registry scan fetched its text with CORS: a host that varies on
    // Origin caches the two request modes apart.
    if (integrity) {
      script.integrity = integrity
    }
    if (integrity || cors) {
      script.crossOrigin = 'anonymous'
    }
    script.src = src
    // A script that throws while it is evaluated still fires `load`, and what
    // it threw goes to the window, where `currentScript` says whose it was. A
    // cross-origin script loaded without CORS reports only "Script error."
    let thrown: ErrorEvent | undefined
    const onWindowError = (event: ErrorEvent) => {
      if (document.currentScript === script) {
        thrown = event
      }
    }
    window.addEventListener('error', onWindowError)
    script.onload = () => {
      window.removeEventListener('error', onWindowError)
      if (thrown) {
        reject(
          new Error(`${src} threw while it was evaluated: ${thrown.message}`, {
            cause: thrown.error,
          }),
        )
      } else {
        resolve(script.src)
      }
    }
    script.onerror = () => {
      window.removeEventListener('error', onWindowError)
      reject(new Error(`Failed to load script: ${src}`))
    }
    document.head.append(script)
  })
}

function hasImportScripts(
  scope: typeof globalThis,
): scope is typeof globalThis & {
  importScripts: (...urls: string[]) => void
} {
  return 'importScripts' in scope && typeof scope.importScripts === 'function'
}

// A module worker has importScripts but throws from it, and called with no
// urls it throws nowhere else
function canImportScripts(
  scope: typeof globalThis,
): scope is typeof globalThis & { importScripts: (url: string) => void } {
  try {
    if (hasImportScripts(scope)) {
      scope.importScripts()
      return true
    } else {
      return false
    }
  } catch {
    return false
  }
}

export function workerScriptLoadMessage(scriptUrl: string, error: unknown) {
  return `Failed to load ${scriptUrl} in the worker: ${error instanceof Error ? error.message : String(error)}`
}

// What importScripts does, for a module worker: run the bundle in the global
// scope. A strict bundle's top-level `var` stays inside the eval, so the eval's
// completion value hands the global back.
async function evalInGlobalScope(
  scriptUrl: string,
  globalName: string,
  integrity?: string,
) {
  const response = await fetch(scriptUrl, { integrity })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  evalScriptText(await response.text(), scriptUrl, globalName)
}

function evalScriptText(text: string, scriptUrl: string, globalName: string) {
  const readGlobal = /^[A-Za-z_$][\w$]*$/.test(globalName)
    ? `typeof ${globalName} === 'undefined' ? undefined : ${globalName}`
    : 'undefined'
  // eslint-disable-next-line no-eval
  const value: unknown = (0, eval)(
    `${text}\n;${readGlobal}\n//# sourceURL=${scriptUrl}`,
  )
  if (value !== undefined) {
    Reflect.set(globalThis, globalName, value)
  }
}

const pluginTexts = new Map<string, Promise<string | undefined>>()

/**
 * A UMD bundle's text, fetched once per realm for the registry scan and then
 * evaluated as the same bytes. `undefined` when the host refuses CORS or the
 * fetch fails, which sends the realm the whole registry and the bundle by its
 * usual route.
 */
function fetchPluginText(url: string, integrity?: string) {
  let text = pluginTexts.get(url)
  if (!text) {
    text = fetch(url, { integrity })
      .then(r => (r.ok ? r.text() : undefined))
      .catch(() => undefined)
    pluginTexts.set(url, text)
  }
  return text
}

/**
 * Start fetching the texts of the UMD bundles a worker was told of ahead of
 * its boot configuration, for the registry scan to read
 */
export function preloadPluginTexts(defs: PluginDefinition[], baseUri?: string) {
  if (!('__jbrowseCacheBuster' in globalThis)) {
    for (const def of defs) {
      void fetchUMDText(def, baseUri)
    }
  }
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

async function loadScript(
  scriptUrl: string,
  globalName: string,
  integrity?: string,
  text?: string,
) {
  const scope = globalThis
  if (!isWebWorker()) {
    await promisifiedLoadScript(scriptUrl, integrity, text !== undefined)
  } else {
    try {
      if (text !== undefined) {
        evalScriptText(text, scriptUrl, globalName)
      } else if (canImportScripts(scope)) {
        await workerPrefetches.get(scriptUrl)
        scope.importScripts(scriptUrl)
      } else {
        await evalInGlobalScope(scriptUrl, globalName, integrity)
      }
    } catch (error) {
      throw new Error(workerScriptLoadMessage(scriptUrl, error), {
        cause: error,
      })
    }
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
 * The rule bites on Desktop, whose instance is a `file://` page, so a relative
 * url resolves to a `file:` url nothing put there. Diagnose that in terms its
 * author can act on: the raw scheme of a url they never wrote ("Cannot load
 * plugins using protocol file:") named the symptom and nothing else, and the
 * reader is usually looking at a third-party hub config.
 *
 * The one `file:` url that loads is a `umdLoc`/`esmLoc` in an instance that is
 * itself a `file:` page (a packaged Desktop), for a config opened from disk.
 * A config from outside sets its own `baseUri` and could aim one at a planted
 * file, so Desktop's trust funnel refuses those before anything loads
 * (`assertPluginsTrusted`). `instance` is the page's url in the worker too, so
 * both realms decide alike; an http(s) page's worker cannot import a `file:`
 * script, and loading it on the page alone left every RPC failing on a
 * terminated worker.
 */
function resolvePluginUrl(spec: string, base?: string, instance?: string) {
  let url: URL
  try {
    url = new URL(spec, base)
  } catch {
    throw new Error(
      `Cannot load plugin "${spec}": it is not a url, and nothing gave it a base to resolve against`,
    )
  }
  const besideLocalConfig =
    url.protocol === 'file:' && !!instance?.startsWith('file:')
  if (
    url.protocol !== 'http:' &&
    url.protocol !== 'https:' &&
    !besideLocalConfig
  ) {
    throw new Error(
      instance !== undefined && url.protocol === 'file:'
        ? `Cannot load plugin "${spec}": it resolves to ${url.href}, and a plugin loads from a local file only in a packaged JBrowse Desktop.`
        : // a spec with a scheme of its own resolved to exactly what it asked
          // for, so there is nothing to explain beyond refusing it
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

// a cache buster query string would change the bytes the browser hashes for
// SRI, so skip it when an integrity hash is present (the url is already
// version-pinned and immutable, so cache-busting is unnecessary anyway)
function umdLoadUrl(
  def: UMDPluginDefinition | LegacyUMDPluginDefinition,
  baseUri?: string,
) {
  const { href } = pluginLoadUrl(def, baseUri)
  return def.integrity ? href : addCacheBuster(href)
}

async function fetchUMDText(def: PluginDefinition, baseUri?: string) {
  if (isUMDPluginDefinition(def)) {
    try {
      const url = umdLoadUrl(def, baseUri)
      const text = await fetchPluginText(url, def.integrity)
      return text === undefined ? undefined : { url, text }
    } catch {
      // loadPlugin reports a url it cannot resolve
    }
  }
  return undefined
}

// the keys every bundle reads, or undefined when any of them cannot say
function keysReadBy(texts: (string | undefined)[]) {
  const keys = new Set<string>()
  for (const text of texts) {
    const read = text === undefined ? undefined : reExportKeysRead(text)
    if (!read) {
      return undefined
    }
    for (const key of read) {
      keys.add(key)
    }
  }
  return keys
}

/**
 * The url PluginLoader fetches a definition from, read from the same pick the
 * trust gate vets (`pluginUrlSource`), with the protocol rules of
 * `resolvePluginUrl` applied.
 */
export function pluginLoadUrl(def: PluginDefinition, baseUri?: string) {
  assertSingleKind(def)
  const source = pluginUrlSource(def)
  if (source === undefined) {
    throw new Error(`Could not determine plugin type: ${JSON.stringify(def)}`)
  }
  return source.loc
    ? resolvePluginUrl(source.spec, source.loc.baseUri, baseUri ?? '')
    : resolvePluginUrl(source.spec, baseUri)
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
    for (const def of canImportScripts(globalThis) ? defs : []) {
      if (isUMDPluginDefinition(def)) {
        try {
          prefetchWorkerScript(pluginLoadUrl(def, baseUri).href)
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
        link.href = pluginLoadUrl(def, baseUri).href
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
    const parsedUrl = pluginLoadUrl(def, baseUri)
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
    fetched?: { url: string; text: string },
  ) {
    const moduleName = def.name
    const umdName = `JBrowsePlugin${moduleName}`
    // An install rebuilds the app in this page, where the build an earlier
    // load left would answer for a bundle that failed to define its own.
    // Assigned, since a bundle's top-level `var` cannot be deleted.
    if (umdName in globalThis) {
      Reflect.set(globalThis, umdName, undefined)
    }
    await loadScript(
      fetched?.url ?? umdLoadUrl(def, baseUri),
      umdName,
      def.integrity,
      fetched?.text,
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

  async loadPlugin(
    def: PluginDefinition,
    baseUri?: string,
    fetched?: { url: string; text: string },
  ) {
    assertRetiredKinds(def)
    assertSingleKind(def)
    armIfUnderDevelopment(def)
    let plugin: LoadedPlugin
    if (isESMPluginDefinition(def)) {
      plugin = await this.loadESMPlugin(def, baseUri)
    } else if (isUMDPluginDefinition(def)) {
      plugin = await this.loadUMDPlugin(def, baseUri, fetched)
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
    | {
        target: WindowOrWorkerGlobalScope
        registry: ReExportRegistryLoader
        loaders?: ReExportLoadersLoader
      }
    | undefined

  /**
   * Ask for the runtime ABI (`JBrowseExports`) to be published on `target`
   * before any plugin bundle is evaluated. Records the target and the loader;
   * `loadSettled` fetches the registry, which only a runtime plugin can use
   * (`ReExports/registry.ts`).
   *
   * `registry` is the product's generated map — `reExports.generated.ts` on
   * the main thread, `workerReExports.generated.ts` in its worker — which
   * serves every `@jbrowse` package the product bundles. The caller names it
   * because the registry serves this module: an `import()` of it from here is
   * a cycle rolldown keeps in any host bundling this file, whether or not
   * anything loads a plugin (EAGER_BUNDLE.md §3).
   *
   * `loaders` is the same map with each key behind its own `import()`
   * (`reExportLoaders.generated.ts`). Given it, the loader reads each UMD
   * bundle's text first and publishes only the keys the bundles read, falling
   * back to `registry` whole when any bundle cannot say (an ESM plugin, a
   * computed read, `jbrequire`, a host refusing CORS).
   */
  installGlobalReExports(
    target: WindowOrWorkerGlobalScope,
    registry: ReExportRegistryLoader,
    loaders?: ReExportLoadersLoader,
  ) {
    this.reExports = { target, registry, loaders }
    return this
  }

  private async publishReExports(keys?: Set<string>) {
    if (this.reExports) {
      const { target, registry, loaders } = this.reExports
      this.reExports = undefined
      if (keys && loaders && !isReExportRegistryComplete()) {
        const { default: all } = await loaders()
        const before = getReExportRegistry()
        const loaded = await Promise.all(
          [...keys].flatMap(key => {
            const load = all[key]
            return load && !(key in before)
              ? [load().then(value => [key, value] as const)]
              : []
          }),
        )
        const libs = { ...before, ...Object.fromEntries(loaded) }
        ;(target as unknown as Record<string, unknown>).JBrowseExports =
          loudOnMissingModule(libs, new Set(Object.keys(all)))
        setReExportRegistry(libs, true)
      } else {
        const { default: ReExports } = await registry()
        ;(target as unknown as Record<string, unknown>).JBrowseExports =
          loudOnMissingModule({ ...ReExports })
        // the synchronous half: `pluginManager.jbrequire(name)` is what a CJS
        // plugin calls, and it cannot await
        setReExportRegistry(ReExports)
      }
    }
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
    const records: PluginRecord[] = []
    const failures: PluginLoadFailure[] = []
    // nothing to load publishes nothing: the registry is ~126 KB gzipped that
    // only a runtime plugin reads
    if (this.definitions.length > 0) {
      const fetched = this.reExports?.loaders
        ? await Promise.all(
            this.definitions.map(def => fetchUMDText(def, baseUri)),
          )
        : undefined
      if (!fetched) {
        preloadUMDBundles(this.definitions, baseUri)
      }
      // before the first plugin script evaluates — a UMD bundle reads
      // `JBrowseExports` off the global at module scope
      await this.publishReExports(
        fetched && keysReadBy(fetched.map(f => f?.text)),
      )
      const results = await Promise.allSettled(
        this.definitions.map(async (definition, i) => ({
          plugin: await this.loadPlugin(definition, baseUri, fetched?.[i]),
          definition,
        })),
      )
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
