const HUB_HOST = 'https://jbrowse.org'

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

/**
 * Fetch a hosted assembly config from genomes.jbrowse.org by UCSC database name
 * or GenArk accession. Use it to discover which trackIds an assembly publishes
 * before naming them in a session.
 */
export async function fetchHubConfig(hub: string): Promise<HubConfig> {
  const url = hubUrl(hub)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `hub "${hub}" not found (HTTP ${res.status} from ${url}). ` +
        'See https://genomes.jbrowse.org for the available assemblies.',
    )
  }
  return (await res.json()) as HubConfig
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
