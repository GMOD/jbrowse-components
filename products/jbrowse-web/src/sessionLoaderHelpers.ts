import {
  buildLgvInit as buildSharedLgvInit,
  splitHighlights,
} from '@jbrowse/app-core'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { dropVendoredPlugins } from '@jbrowse/core/pluginDefinitions'
import { indexedDBAvailable, resolveStorePluginRefs } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import packageJSON from '../package.json' with { type: 'json' }
import { openSessionDB } from './openSessionDB.ts'
import { configBaseUri } from './resolveConfigPath.ts'
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
  const { definitions, failures: unresolved } = await resolveStorePluginRefs(
    defs,
    packageJSON.version,
  )
  const loader = new PluginLoader(dropVendoredPlugins(definitions), {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  loader.installGlobalReExports(window)
  const { records, failures } = await loader.loadSettled(window.location.href)
  // A ref with no build for this JBrowse and a bundle that 404s are the same
  // thing to the person looking at the session — a feature that is not there —
  // so they are reported through one path.
  return { records: [...records], failures: [...unresolved, ...failures] }
}

export function readSessionFromStorage(query: string) {
  try {
    const str = sessionStorage.getItem('current')
    if (str) {
      const snap = JSON.parse(str).session ?? {}
      if (query === snap.id) {
        return snap as Snap
      }
    }
  } catch (e) {
    console.error(e)
  }
  return undefined
}

export async function readSessionFromIDB(query: string) {
  // no autosave database to read where there is no IndexedDB (jsdom, a locked
  // down browser profile). The root model gates setupSessionDB on the same
  // predicate, which is where the reasoning lives.
  if (!indexedDBAvailable()) {
    return undefined
  }
  let db: Awaited<ReturnType<typeof openSessionDB>> | undefined
  try {
    db = await openSessionDB()
    return await db.get('sessions', query)
  } catch (e) {
    console.error(e)
    return undefined
  } finally {
    // one-shot read at boot, from a connection the root model does not share.
    // Left open it lives for the tab, and an open connection at the old version
    // is what makes another tab's upgrade hang instead of run.
    db?.close()
  }
}

/**
 * Puts a session into the autosave database from outside the root model that
 * owns it — the crash-recovery path, which has to keep a session it is about to
 * stop being the current one.
 *
 * Needed because the two autosaves are not equivalent. The sessionStorage
 * mirror is the fresher of the pair (the unload flush writes there and not
 * here, and both are debounced 400ms), and the fresh session's own autosave is
 * about to overwrite it — so a crash inside that first debounce window is
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
  if (
    !indexedDBAvailable() ||
    typeof id !== 'string' ||
    typeof name !== 'string'
  ) {
    return false
  }
  let db: Awaited<ReturnType<typeof openSessionDB>> | undefined
  try {
    db = await openSessionDB()
    await upsertSessionRows(db, { ...snap, id, name }, { id, name, configPath })
    return true
  } catch (e) {
    console.error(e)
    return false
  } finally {
    // same one-shot discipline as readSessionFromIDB: a connection left open at
    // the old version is what makes another tab's upgrade hang
    db?.close()
  }
}

export async function fetchRemoteConfig(configPath: string) {
  const text = await openLocation({
    uri:
      configPath +
      (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : ''),
    locationType: 'UriLocation',
  }).readFile('utf8')
  const config = JSON.parse(text)
  const configUri = configBaseUri(configPath)
  addRelativeUris(config, configUri)
  return { config, configUri }
}

export { splitHighlights }

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

// The recognized `session=` type prefixes; single source for stripPrefix and
// the loader's sessionQueryType dispatch so they can't drift
const SESSION_QUERY_PREFIXES = [
  'share',
  'spec',
  'encoded',
  'json',
  'local',
] as const
const PREFIX_RE = new RegExp(`^(${SESSION_QUERY_PREFIXES.join('|')})-`)

// Strips the share-/spec-/encoded-/json-/local- prefix from a sessionQuery
export const stripPrefix = (s: string) => s.replace(PREFIX_RE, '')

// Returns the type prefix (without the trailing `-`), or undefined when the
// sessionQuery has no recognized prefix
export const getSessionQueryType = (s: string) => PREFIX_RE.exec(s)?.[1]
