import PluginLoader, { dropVendoredPlugins } from '@jbrowse/core/PluginLoader'
import { openLocation } from '@jbrowse/core/util/io'

import { openSessionDB } from './openSessionDB.ts'
import { addRelativeUris } from './util.ts'

import type { Snap } from './types.ts'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export async function loadPluginRecords(defs: PluginDefinition[]) {
  const loader = new PluginLoader(dropVendoredPlugins(defs), {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  loader.installGlobalReExports(window)
  return [...(await loader.load(window.location.href))]
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

export function buildJb1SessionSpec(args: {
  loc?: string
  tracks?: string
  assembly?: string
  tracklist?: boolean
  nav?: boolean
  highlight?: string
  sessionTracks: Record<string, unknown>[]
}) {
  return {
    sessionTracks: args.sessionTracks,
    views: [
      {
        type: 'LinearGenomeView',
        tracks: args.tracks?.split(','),
        loc: args.loc,
        assembly: args.assembly,
        tracklist: args.tracklist,
        nav: args.nav,
        highlight: args.highlight ? splitHighlights(args.highlight) : undefined,
      },
    ],
  }
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
export const getSessionQueryType = (s: string) => (PREFIX_RE.exec(s))?.[1]
