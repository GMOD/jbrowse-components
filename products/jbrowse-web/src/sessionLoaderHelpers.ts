import PluginLoader from '@jbrowse/core/PluginLoader'
import { dropVendoredPlugins } from '@jbrowse/core/pluginDefinitions'
import { openLocation } from '@jbrowse/core/util/io'

import { openSessionDB } from './openSessionDB.ts'
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
  const loader = new PluginLoader(dropVendoredPlugins(defs), {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  loader.installGlobalReExports(window)
  const { records, failures } = await loader.loadSettled(window.location.href)
  return { records: [...records], failures }
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
  try {
    const db = await openSessionDB()
    return await db.get('sessions', query)
  } catch (e) {
    console.error(e)
    return undefined
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
  const configUri = new URL(configPath, window.location.href)
  addRelativeUris(config, configUri)
  return { config, configUri }
}

// split a space-separated &highlight= URL param into individual highlights.
// spaces inside a JSON object ({...}) are not treated as delimiters, so a
// highlight like {"refName":"chr1","start":1,"end":2,"label":"my region"}
// survives intact alongside plain loc strings
export function splitHighlights(str: string) {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '{') {
      depth++
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1)
    }
    if (ch === ' ' && depth === 0) {
      if (cur) {
        out.push(cur)
      }
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur) {
    out.push(cur)
  }
  return out
}

// Normalizes the loc/tracks/assembly/... URL params into a LinearGenomeView
// init shape. Read once by the loader (its `urlViewInit` getter) and reused by
// every route the shorthand can take — a fresh spec, layered onto the
// defaultSession, or riding along on a hub — so the comma/space splitting can't
// drift between them.
//
// A param the URL omits is left off the result rather than set to undefined:
// applyDefaultSessionViewInit merges this over the view's own pending init, and
// a present-but-undefined key there would erase what the defaultSession set.
export function buildLgvInit(args: {
  loc?: string
  tracks?: string
  assembly?: string
  tracklist?: boolean
  nav?: boolean
  highlight?: string
  regions?: string
}): Partial<InitState> {
  const { loc, tracks, assembly, tracklist, nav, highlight, regions } = args
  const init: Partial<InitState> = {}
  if (loc !== undefined) {
    init.loc = loc
  }
  if (assembly !== undefined) {
    init.assembly = assembly
  }
  if (tracks !== undefined) {
    init.tracks = tracks.split(',')
  }
  if (tracklist !== undefined) {
    init.tracklist = tracklist
  }
  if (nav !== undefined) {
    init.nav = nav
  }
  if (highlight !== undefined) {
    init.highlight = splitHighlights(highlight)
  }
  if (regions !== undefined) {
    // restrict a whole-genome view (no loc) to these named chromosomes, in
    // order; resolved through assembly aliases in afterAttach's showNamedRegions
    init.displayedRegionNames = regions.split(',')
  }
  return init
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
