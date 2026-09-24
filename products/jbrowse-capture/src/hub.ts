const HUB_HOST = 'https://jbrowse.org'
const FETCH_TIMEOUT_MS = 30000

const BROWSE_HINT =
  'See https://genomes.jbrowse.org for the available assemblies.'

// A copy of hubUrl in packages/core/src/util/fetchHub.ts, so an npx install
// stays puppeteer-only; hub.test.ts holds the two together.
export function hubUrl(hub: string) {
  const genark = /^(GC[AF])_(\d{3})(\d{3})(\d{3})/.exec(hub)
  return genark
    ? `${HUB_HOST}/hubs/genark/${genark[1]}/${genark[2]}/${genark[3]}/${genark[4]}/${hub}/config.json`
    : `${HUB_HOST}/ucsc/${hub}/config.json`
}

export interface Track {
  trackId: string
  type?: string
  name?: unknown
}

export const trackName = (track: Track) =>
  typeof track.name === 'string' ? track.name : ''

/** Tracks whose id or display name contains `filter`, ignoring case. */
export function tracksMatching(tracks: Track[], filter: string) {
  const needle = filter.toLowerCase()
  return tracks.filter(t =>
    `${t.trackId} ${trackName(t)}`.toLowerCase().includes(needle),
  )
}

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
export async function listHubTracks(hub: string, filter?: string) {
  const { tracks = [] } = (await fetchJson(hubUrl(hub), `hub "${hub}"`)) as {
    tracks?: Track[]
  }
  return filter ? tracksMatching(tracks, filter) : tracks
}
