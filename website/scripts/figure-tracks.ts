// The tracks a tutorial figure opens that its page never names: no fence or
// sentence carries the track's id or its name, so a reader following the page
// on their own instance cannot get the picture. check-figure-tracks.ts ratchets
// the count per page.
//
// A figure's tracks come from its live link (liveLinks.generated.ts), the same
// config and session the capture drew. A track's name lives in that config; a
// remote config's names are recorded in figure-track-names.json so the check
// runs offline.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { figureLiveRefs } from '../src/lib/liveLinks.generated.ts'
import { figureTags } from './check-utils.ts'
import { repoRoot } from './paths.ts'

export const namesFile = join(import.meta.dirname, 'figure-track-names.json')

export type TrackNames = Record<string, Record<string, string>>

export interface FigureTracks {
  figure: string
  line: number
  config: string
  trackIds: string[]
  // Names of the tracks the figure's session defines itself.
  sessionNames: Record<string, string>
}

export const isRemote = (config: string) => /^https?:/.test(config)

function collectTrackIds(node: unknown, out: Set<string>, inTracks = false) {
  if (typeof node === 'string') {
    if (inTracks) {
      out.add(node)
    }
  } else if (Array.isArray(node)) {
    for (const n of node) {
      collectTrackIds(n, out, inTracks)
    }
  } else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    const id = o.trackId ?? o.configuration
    if (inTracks && typeof id === 'string') {
      out.add(id)
    }
    for (const [k, v] of Object.entries(o)) {
      collectTrackIds(v, out, k === 'tracks')
    }
  }
}

function specTracks(spec: string) {
  const ref = figureLiveRefs[spec]
  if (!ref?.startsWith('?')) {
    return undefined
  }
  const query = new URLSearchParams(ref.slice(1))
  const session = query.get('session') ?? ''
  if (!session.startsWith('spec-')) {
    return undefined
  }
  const parsed = JSON.parse(session.slice('spec-'.length)) as {
    sessionTracks?: { trackId: string; name?: string }[]
  }
  const ids = new Set<string>()
  collectTrackIds(parsed, ids)
  const sessionNames = Object.fromEntries(
    (parsed.sessionTracks ?? []).flatMap(t =>
      t.name ? [[t.trackId, t.name]] : [],
    ),
  )
  return { config: query.get('config') ?? '', trackIds: [...ids], sessionNames }
}

export function figureTracks(text: string): FigureTracks[] {
  return figureTags(text).flatMap(({ attrs, index }) => {
    const src = /^\/img\/(.+)\.png$/.exec(attrs.src ?? '')?.[1]
    const linked = (attrs.links ?? '')
      .split(',')
      .map(pair => pair.split('=')[1]?.trim())
      .filter((s): s is string => !!s)
    const line = text.slice(0, index).split('\n').length
    return [...(src ? [src] : []), ...linked].flatMap(figure => {
      const tracks = specTracks(figure)
      return tracks ? [{ figure, line, ...tracks }] : []
    })
  })
}

interface ConfigTrack {
  trackId: string
  name?: string
  type?: string
}

const localNames = new Map<string, Map<string, ConfigTrack>>()
function localConfigTracks(config: string) {
  let tracks = localNames.get(config)
  if (!tracks) {
    const path = join(repoRoot, config)
    const parsed = existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as { tracks?: ConfigTrack[] })
      : {}
    tracks = new Map((parsed.tracks ?? []).map(t => [t.trackId, t]))
    localNames.set(config, tracks)
  }
  return tracks
}

export function trackName(config: string, trackId: string, names: TrackNames) {
  return isRemote(config)
    ? names[config]?.[trackId]
    : localConfigTracks(config).get(trackId)?.name
}

// An assembly's sequence track comes with the assembly the page loads.
const isSequenceTrack = (config: string, trackId: string) =>
  trackId.endsWith('-ReferenceSequenceTrack') ||
  (!isRemote(config) &&
    localConfigTracks(config).get(trackId)?.type === 'ReferenceSequenceTrack')

export interface UnnamedTrack {
  line: number
  figure: string
  trackId: string
  name?: string
}

// A name prose wraps across lines still names the track.
const oneLine = (s: string) => s.replace(/\s+/g, ' ')

// The tutorials a page's Prerequisites section links: a page built on another's
// tracks (cnv_cgiab on sv_visualization_cgiab) names them there.
export function prerequisiteTutorials(text: string) {
  const section = /^## Prerequisites\n([\s\S]*?)(?=^## )/m.exec(text)?.[1] ?? ''
  return [
    ...new Set(
      [...section.matchAll(/\/docs\/tutorials\/([\w-]+)/g)].map(m => m[1]!),
    ),
  ]
}

// `context` is the text of the pages the reader set up first.
export function unnamedFigureTracks(
  text: string,
  names: TrackNames,
  context: string[] = [],
) {
  const all = [text, ...context].join('\n')
  const flat = oneLine(all)
  return figureTracks(text).flatMap(
    ({ figure, line, config, trackIds, sessionNames }) =>
      trackIds
        .filter(id => !isSequenceTrack(config, id))
        .map(trackId => ({
          line,
          figure,
          trackId,
          name: sessionNames[trackId] ?? trackName(config, trackId, names),
        }))
        .filter(
          t =>
            !all.includes(t.trackId) &&
            !(t.name && flat.includes(oneLine(t.name))),
        ),
  )
}
