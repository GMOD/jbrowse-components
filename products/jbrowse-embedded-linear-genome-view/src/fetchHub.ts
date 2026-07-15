const HUB_HOST = 'https://jbrowse.org'

export interface HubConfig {
  assemblies?: Record<string, unknown>[]
  aggregateTextSearchAdapters?: Record<string, unknown>[]
  tracks?: Record<string, unknown>[]
  [key: string]: unknown
}

// A UCSC database name (hg38, mm10, ...) maps to /ucsc/<db>/; a GenArk accession
// (GCA_/GCF_...) fans its 9 digits out into a 3-level directory tree.
export function hubUrl(hub: string) {
  const genark = /^(GC[AF])_(\d{3})(\d{3})(\d{3})/.exec(hub)
  return genark
    ? `${HUB_HOST}/hubs/genark/${genark[1]}/${genark[2]}/${genark[3]}/${genark[4]}/${hub}/config.json`
    : `${HUB_HOST}/ucsc/${hub}/config.json`
}

// Hosted configs reference their data with URIs relative to the config's own
// location; stamp each data node with baseUri so they resolve — the same pass
// jbrowse-web runs when it loads a config from a URL.
function stampBaseUri(node: unknown, base: string) {
  if (Array.isArray(node)) {
    for (const value of node) {
      stampBaseUri(value, base)
    }
  } else if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>
    // fill baseUri when absent — mirror jbrowse-web's `baseUri ?? base` so a node
    // carrying an explicit null/undefined baseUri still resolves (an `in` check
    // would wrongly treat that as already-stamped)
    if ('uri' in record && record.baseUri == null) {
      record.baseUri = base
    }
    for (const value of Object.values(record)) {
      stampBaseUri(value, base)
    }
  }
}

/**
 * Fetch a hosted assembly config from jbrowse.org by UCSC database name (`hg38`,
 * `mm10`, ...) or GenArk accession (`GCA_...`/`GCF_...`). Returns the full config
 * — a self-contained assembly plus a catalog of CORS-enabled hosted tracks. Pass
 * the name straight to `createLinearGenomeView({ assembly: 'hg38' })` for the
 * common case; call this directly only to cherry-pick tracks from the catalog.
 */
export async function fetchHub(hub: string): Promise<HubConfig> {
  const url = hubUrl(hub)
  const response = await fetch(url)
  if (response.ok) {
    const config = (await response.json()) as HubConfig
    stampBaseUri(config, url)
    return config
  } else {
    throw new Error(
      `hub "${hub}" not found (${response.status} from ${url}). ` +
        'See https://jbrowse.org for available assemblies.',
    )
  }
}
