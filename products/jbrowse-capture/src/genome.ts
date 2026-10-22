import { genomeConfigUrl, trackMatches } from '@jbrowse/launch-args'

import type { Track } from '@jbrowse/launch-args'

const HUB_HOST = 'https://jbrowse.org'
const FETCH_TIMEOUT_MS = 30000

const BROWSE_HINT =
  'See https://genomes.jbrowse.org for the available assemblies.'

/** Fetch JSON with a timeout, throwing a message that names `what` and the URL. */
export async function fetchJson(url: string, what: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new Error(
      `${what} could not be fetched from ${url} ` +
        `(${error instanceof Error ? error.message : error}${
          timedOut ? `, after ${FETCH_TIMEOUT_MS}ms` : ''
        }). ${BROWSE_HINT}`,
    )
  })
  if (!res.ok) {
    throw new Error(
      `${what} not found (HTTP ${res.status} from ${url}). ${BROWSE_HINT}`,
    )
  }
  return res.json()
}

interface HostedAssembly {
  name: string
  organism?: string
  description?: string
}

/**
 * The UCSC assemblies genomes.jbrowse.org hosts. Its thousands of GenArk
 * accessions are not listed.
 */
export async function listHubAssemblies(): Promise<HostedAssembly[]> {
  const { ucscGenomes = {} } = (await fetchJson(
    `${HUB_HOST}/ucsc/list.json`,
    'the hosted assembly list',
  )) as { ucscGenomes?: Record<string, Omit<HostedAssembly, 'name'>> }
  return Object.entries(ucscGenomes)
    .map(([name, { organism, description }]) => ({
      name,
      organism,
      description,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The tracks a hosted assembly publishes, optionally narrowed by `filter`. */
export async function listHubTracks(genome: string, filter?: string) {
  const { tracks = [] } = (await fetchJson(
    genomeConfigUrl(genome),
    `genome "${genome}"`,
  )) as {
    tracks?: Track[]
  }
  const needle = filter?.toLowerCase()
  return needle ? tracks.filter(t => trackMatches(t, needle)) : tracks
}
