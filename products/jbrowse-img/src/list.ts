import { resolveConfigObject } from './resolveHub.ts'
import { trackName, trackType } from './trackFields.ts'

import type { Track } from './types.ts'

// `jb2export list` discovery: print the assemblies hosted on
// genomes.jbrowse.org, or the tracks inside one hub's config, so a user can find
// the --hub name and --track ids without leaving the terminal. The formatting is
// split from the fetch so it's unit-testable without the network.

// UCSC genome-list metadata (jbrowse.org/ucsc/list.json), keyed by db name.
interface UcscGenome {
  organism?: string
  description?: string
  scientificName?: string
}

const LIST_URL = 'https://jbrowse.org/ucsc/list.json'

export function formatAssemblies(genomes: Record<string, UcscGenome>) {
  const names = Object.keys(genomes).sort()
  const pad = Math.max(0, ...names.map(n => n.length))
  const lines = names.map(name => {
    const g = genomes[name]!
    const about = [g.organism, g.description].filter(Boolean).join(' — ')
    return `  ${name.padEnd(pad)}  ${about}`
  })
  return [
    `Assemblies on genomes.jbrowse.org (${names.length}):`,
    ...lines,
    '',
    'Render one:      jb2export --hub <name> --loc <region> --out out.svg',
    'List its tracks: jb2export list <name> [filter]',
  ].join('\n')
}

export function formatTracks(hub: string, tracks: Track[], filter?: string) {
  const needle = filter?.toLowerCase()
  const matched = needle
    ? tracks.filter(
        t =>
          t.trackId.toLowerCase().includes(needle) ||
          trackName(t).toLowerCase().includes(needle),
      )
    : tracks
  const pad = Math.min(60, Math.max(0, ...matched.map(t => t.trackId.length)))
  const lines = matched.map(
    t =>
      `  ${t.trackId.padEnd(pad)}  ${trackType(t).padEnd(18)}  ${trackName(t)}`,
  )
  const count = filter
    ? `${matched.length} of ${tracks.length} matching "${filter}"`
    : `${matched.length}`
  return [
    `Tracks in ${hub} (${count}):`,
    ...lines,
    '',
    `Show one: jb2export --hub ${hub} --track <trackId> --loc <region> --out out.svg`,
  ].join('\n')
}

async function fetchJson(url: string, context: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${context}: HTTP ${res.status} from ${url}`)
  }
  return res.json() as Promise<unknown>
}

// `jb2export list` -> assemblies; `jb2export list <hub> [filter]` -> that hub's
// tracks. Returns the text to print.
export async function runList(args: string[]) {
  const [hub, filter] = args
  if (hub) {
    const config = await resolveConfigObject({ hub })
    return formatTracks(hub, config?.tracks ?? [], filter)
  }
  const data = (await fetchJson(LIST_URL, 'Failed to fetch assembly list')) as {
    ucscGenomes?: Record<string, UcscGenome>
  }
  return formatAssemblies(data.ucscGenomes ?? {})
}
