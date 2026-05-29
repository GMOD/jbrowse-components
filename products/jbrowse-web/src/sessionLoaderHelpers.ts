import PluginLoader from '@jbrowse/core/PluginLoader'
import { openLocation } from '@jbrowse/core/util/io'
import { openDB } from 'idb'

import { addRelativeUris } from './util.ts'

import type { SessionDB, Snap } from './types.ts'
import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export async function loadPluginRecords(defs: PluginDefinition[]) {
  const loader = new PluginLoader(defs, {
    fetchESM: url => import(/* webpackIgnore:true */ url),
  })
  loader.installGlobalReExports(window)
  return [...(await loader.load(window.location.href))]
}

export function readSessionFromStorage(query: string) {
  const str = sessionStorage.getItem('current')
  if (str) {
    const snap = JSON.parse(str).session ?? {}
    if (query === snap.id) {
      return snap as Snap
    }
  }
  return undefined
}

export async function readSessionFromIDB(query: string) {
  try {
    const db = await openDB<SessionDB>('sessionsDB', 2, {
      upgrade(db) {
        db.createObjectStore('metadata')
        db.createObjectStore('sessions')
      },
    })
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
      // @ts-expect-error
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
  sessionTracks: unknown
}) {
  return {
    sessionTracks: args.sessionTracks,
    views: [
      {
        type: 'LinearGenomeView',
        tracks: args.tracks?.split(','),
        sessionTracks: args.sessionTracks,
        loc: args.loc,
        assembly: args.assembly,
        tracklist: args.tracklist,
        nav: args.nav,
        highlight: args.highlight ? splitHighlights(args.highlight) : undefined,
      },
    ],
  }
}

// Strips share-/spec-/encoded-/json-/local- prefix from a sessionQuery
export const stripPrefix = (s: string) =>
  s.replace(/^(share|spec|encoded|json|local)-/, '')
