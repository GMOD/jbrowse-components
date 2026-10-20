import { trackMatches, trackName, trackType } from '@jbrowse/launch-args'

import { FETCH_TIMEOUT_MS, resolveConfigObject } from './resolveHub.ts'

import type { Track } from './types.ts'

// `jb2export list` discovery: print the assemblies hosted on
// genomes.jbrowse.org, or the tracks inside one genome's config, so a user can find
// the --genome name and --track ids without leaving the terminal. The formatting is
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
    'Render one:      jb2export --genome <name> --loc <region> --out out.svg',
    'List its tracks: jb2export list <name> [filter]',
  ].join('\n')
}

export function formatTracks(genome: string, tracks: Track[], filter?: string) {
  const needle = filter?.toLowerCase()
  const matched = needle ? tracks.filter(t => trackMatches(t, needle)) : tracks
  const pad = Math.min(60, Math.max(0, ...matched.map(t => t.trackId.length)))
  const lines = matched.map(
    t =>
      `  ${t.trackId.padEnd(pad)}  ${trackType(t).padEnd(18)}  ${trackName(t)}`,
  )
  const count = filter
    ? `${matched.length} of ${tracks.length} matching "${filter}"`
    : `${matched.length}`
  return [
    `Tracks in ${genome} (${count}):`,
    ...lines,
    '',
    `Show one: jb2export --genome ${genome} --track <trackId> --loc <region> --out out.svg`,
  ].join('\n')
}

async function fetchJson(url: string, context: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`${context}: HTTP ${res.status} from ${url}`)
  }
  return res.json() as Promise<unknown>
}

// `jb2export list` -> assemblies; `jb2export list <genome> [filter]` -> that genome's
// tracks. Returns the text to print.
export async function runList(args: string[]) {
  const [genome, filter] = args
  if (genome) {
    const config = await resolveConfigObject({ genome })
    return formatTracks(genome, config?.tracks ?? [], filter)
  }
  const data = (await fetchJson(LIST_URL, 'Failed to fetch assembly list')) as {
    ucscGenomes?: Record<string, UcscGenome>
  }
  return formatAssemblies(data.ucscGenomes ?? {})
}
