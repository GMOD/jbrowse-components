const HUB_HOST = 'https://jbrowse.org'
const HUB_FETCH_TIMEOUT_MS = 30000

// The genomes.jbrowse.org URL scheme: a UCSC database name (hg38, mm10, ...)
// maps to /ucsc/<db>/config.json; a GenArk accession (GCA_/GCF_...) fans its 9
// digits out into a 3-level directory tree.
//
// Deliberately a copy of `hubUrl` in packages/core/src/util/fetchHub.ts rather
// than an import of it. This package is what an agent reaches for with a bare
// `npx`, and its only runtime dependency is puppeteer; pulling in @jbrowse/core
// (react, mobx, the whole state tree) to evaluate one regex would be the largest
// thing in the install by far. `hub.test.ts` imports both and asserts they agree
// on every shape, so the copy cannot drift silently.
export function hubUrl(hub: string) {
  const genark = /^(GC[AF])_(\d{3})(\d{3})(\d{3})/.exec(hub)
  return genark
    ? `${HUB_HOST}/hubs/genark/${genark[1]}/${genark[2]}/${genark[3]}/${genark[4]}/${hub}/config.json`
    : `${HUB_HOST}/ucsc/${hub}/config.json`
}

interface HubTrack {
  trackId: string
  type?: string
  name?: string
}

interface HubConfig {
  tracks?: HubTrack[]
  [key: string]: unknown
}

const BROWSE_HINT =
  'See https://genomes.jbrowse.org for the available assemblies.'

// Bounded: fetch has no timeout of its own, and these are the requests the tool
// makes outside puppeteer's budget, so without it a stalled connection hangs
// `jb2capture list` forever.
async function fetchHosted(url: string, what: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(HUB_FETCH_TIMEOUT_MS),
  }).catch((error: unknown) => {
    // The budget is only part of the diagnosis when it is what fired; naming it
    // on a DNS failure reads as though the request had been given 30s to resolve.
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new Error(
      `${what} could not be fetched from ${url} ` +
        `(${error instanceof Error ? error.message : error}${
          timedOut ? `, after ${HUB_FETCH_TIMEOUT_MS}ms` : ''
        }). ${BROWSE_HINT}`,
    )
  })
  if (!res.ok) {
    throw new Error(
      `${what} not found (HTTP ${res.status} from ${url}). ${BROWSE_HINT}`,
    )
  }
  return res.json() as Promise<unknown>
}

/**
 * Fetch a hosted assembly config from genomes.jbrowse.org by UCSC database name
 * or GenArk accession. Use it to discover which trackIds an assembly publishes
 * before naming them in a session.
 */
export async function fetchHubConfig(hub: string): Promise<HubConfig> {
  return (await fetchHosted(hubUrl(hub), `hub "${hub}"`)) as HubConfig
}

interface HostedAssembly {
  name: string
  organism?: string
  description?: string
}

/**
 * The UCSC assemblies genomes.jbrowse.org hosts, by name. GenArk accessions
 * are hosted too, thousands of them, and are not in this list.
 */
export async function listHubAssemblies(): Promise<HostedAssembly[]> {
  const { ucscGenomes = {} } = (await fetchHosted(
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

/**
 * The trackIds a hosted assembly publishes, optionally narrowed to those whose
 * id or display name contains `filter`. Case-insensitive, because a hub carries
 * hundreds of tracks and an agent picking one from a name is the common case.
 */
export async function listHubTracks(hub: string, filter?: string) {
  const { tracks = [] } = await fetchHubConfig(hub)
  const needle = filter?.toLowerCase()
  return needle
    ? tracks.filter(t =>
        `${t.trackId} ${t.name ?? ''}`.toLowerCase().includes(needle),
      )
    : tracks
}
