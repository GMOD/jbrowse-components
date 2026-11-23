import { buildLgvInit as buildSharedLgvInit } from '@jbrowse/app-core'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { dropVendoredPlugins } from '@jbrowse/core/pluginDefinitions'
import { isObject, resolveStorePluginRefs } from '@jbrowse/core/util'

import packageJSON from '../package.json' with { type: 'json' }
import { takePrefetchedConfig } from './prefetchConfig.ts'
import { hintPrewarmedWorker } from './prewarmedWorker.ts'
import { servedConfigUri } from './resolveConfigPath.ts'
import { getSessionDB } from './sessionDB.ts'
import { upsertSessionRows } from './sessionDbOps.ts'
import { addRelativeUris } from './util.ts'

import type { Snap } from './types.ts'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { InitState } from '@jbrowse/plugin-linear-genome-view'

/**
 * Loads the plugin definitions a config or session named, returning the ones
 * that loaded alongside the ones that didn't. A plugin that fails no longer
 * fails the whole app — the session opens without whatever that plugin provided,
 * and the caller reports the failure once there is a session to report it on.
 */
export async function loadPluginRecords(defs: PluginDefinition[]) {
  // Store refs resolve first: `dropVendoredPlugins` matches on the UMD name a
  // ref does not carry until the store supplies it, so a config naming a
  // vendored plugin by package would otherwise install a second copy beside
  // core's. Resolution fetches nothing unless a definition is actually a ref.
  //
  // What resolution produces is what the rest of the session sees — the trust
  // gate has already run, PluginManager records these definitions, and
  // RpcManager ships them to the worker. So main thread and worker cannot
  // resolve the same ref to two different builds; only one of them resolves.
  //
  // The registry's loader map does not depend on which build a ref resolves
  // to, so it downloads while the store answers.
  const loaders = dropVendoredPlugins(defs).length
    ? import('./reExportLoaders.generated.ts')
    : undefined
  loaders?.catch(() => {})
  const { definitions, failures: unresolved } = await resolveStorePluginRefs(
    defs,
    packageJSON.version,
  )
  const toLoad = dropVendoredPlugins(definitions)
  if (toLoad.length) {
    hintPrewarmedWorker(toLoad)
  }
  const { records, failures } = await new PluginLoader(toLoad, {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
    .installGlobalReExports(
      window,
      () => import('./reExports.generated.ts'),
      () => loaders ?? import('./reExportLoaders.generated.ts'),
    )
    .loadSettled(window.location.href)
  // A ref with no build for this JBrowse and a bundle that 404s are the same
  // thing to the person looking at the session — a feature that is not there —
  // so they are reported through one path.
  return { records, failures: [...unresolved, ...failures] }
}

export function readSessionFromStorage(query: string) {
  try {
    const str = sessionStorage.getItem('current')
    if (str) {
      const parsed: unknown = JSON.parse(str)
      const snap = isObject(parsed) ? parsed.session : undefined
      if (isObject(snap) && query === snap.id) {
        return snap
      }
    }
  } catch (e) {
    console.error(e)
  }
  return undefined
}

export async function readSessionFromIDB(query: string) {
  try {
    const db = await getSessionDB()
    return await db?.get('sessions', query)
  } catch (e) {
    console.error(e)
    return undefined
  }
}

/**
 * Puts a session into the autosave database from outside the root model that
 * owns it — the crash-recovery path, which has to keep a session it is about to
 * stop being the current one.
 *
 * Needed because the two autosaves are not equivalent. The sessionStorage
 * mirror is the fresher of the pair (the unload flush writes there and not
 * here, and both are throttled to 400ms), and the fresh session's own autosave is
 * about to overwrite it — so a crash inside that first 400ms window is
 * exactly the case where letting go of the sessionStorage copy loses the
 * session for good. This is the write that makes "starting over keeps your
 * crashed session" true rather than merely usual.
 *
 * upsertSessionRows over an existing row is safe: it carries `favorite` and
 * `createdAt` forward, so re-writing a session already in the database costs
 * only a bumped `updatedAt`.
 */
export async function writeSessionToIDB(snap: Snap, configPath: string) {
  const { id, name } = snap
  try {
    const db = await getSessionDB()
    if (db && typeof id === 'string' && typeof name === 'string') {
      await upsertSessionRows(
        db,
        { ...snap, id, name },
        { id, name, configPath, edited: true },
      )
      return true
    }
    return false
  } catch (e) {
    console.error(e)
    return false
  }
}

async function fetchConfigJson(configPath: string) {
  const uri =
    configPath + (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : '')
  const response = await fetch(uri)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${uri}`)
  }
  const config: unknown = await response.json()
  return { config, url: response.url }
}

/**
 * Fetch the config and resolve its relative uris against the url it was
 * served from, after any redirect, which is also the origin the plugin trust
 * prompt judges it by
 */
export async function fetchRemoteConfig(configPath: string) {
  const { config, url } =
    (await takePrefetchedConfig(configPath)) ??
    (await fetchConfigJson(configPath))
  if (!isConfigSnap(config)) {
    throw new Error(`${configPath} is not a JBrowse config`)
  }
  const configUri = servedConfigUri(configPath, url)
  addRelativeUris(config, configUri)
  return { config, configUri }
}

function isConfigSnap(
  value: unknown,
): value is Snap & { plugins?: PluginDefinition[] } {
  return (
    isObject(value) &&
    (value.plugins === undefined || Array.isArray(value.plugins))
  )
}

// The loc/tracks/assembly/... shorthand normalizer, which now lives in app-core
// next to parseSessionSpecUrl: Desktop resolves the same links, and a second
// implementation of the comma/space splitting is the thing that would let the
// two disagree about what one URL means.
//
// Wrapped rather than re-exported so this stays annotated with the real
// InitState. app-core cannot import that type (it does not depend on the LGV
// plugin) and restates the shape structurally, so this line is where the two are
// checked against each other — if the restatement ever stops being assignable,
// it fails here rather than somewhere downstream.
export function buildLgvInit(
  args: Parameters<typeof buildSharedLgvInit>[0],
): Partial<InitState> {
  return buildSharedLgvInit(args)
}
