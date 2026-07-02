import { addRelativeUris } from '@jbrowse/product-core'

import type { Config } from './types.ts'

// genomes.jbrowse.org hosts a self-contained config.json per assembly: the
// assembly (remote 2bit sequence, refNameAliases, cytobands, geneticCodes) plus
// its full track set, all as remote URIs. `--hub` pulls one of these so a user
// gets cytobands/aliasing/hosted trackIds without hand-wiring --fasta/--aliases.
const GENOMES = 'https://jbrowse.org'

// Map a --hub token to its hosted config.json URL. A GenArk accession
// (GCA_/GCF_ + 9 digits) lives under /hubs/genark with the digits split into
// triplets, e.g. GCA_964188535.1 -> GCA/964/188/535/GCA_964188535.1/config.json;
// anything else is treated as a UCSC db name -> /ucsc/<db>/config.json.
export function hubToConfigUrl(hub: string) {
  const m = /^(GC[AF])_(\d{3})(\d{3})(\d{3})/.exec(hub)
  return m
    ? `${GENOMES}/hubs/genark/${m[1]}/${m[2]}/${m[3]}/${m[4]}/${hub}/config.json`
    : `${GENOMES}/ucsc/${hub}/config.json`
}

function isUrl(str: string) {
  return /^https?:\/\//i.test(str)
}

async function fetchConfig(url: string, context: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `${context}: HTTP ${res.status} from ${url}. ` +
        'See https://genomes.jbrowse.org for available assemblies.',
    )
  }
  const config = (await res.json()) as Config
  // Hosted configs (e.g. jb2hubs gene tracks) reference data with URIs relative
  // to the config's own location. jbrowse-web resolves these because it loads
  // the config from a URL; here the config is fetched and injected as an object,
  // so stamp each UriLocation with the config URL as baseUri (the same pass
  // jbrowse-web runs) for later resolveUriLocation to resolve against.
  addRelativeUris(config, new URL(url))
  return config
}

// Fetch the config object when it must come off the network: a --hub token
// (resolved to its genomes.jbrowse.org URL) or a --config that is itself a URL.
// Returns undefined when neither applies, so readData falls back to its local
// --config file read.
export async function resolveConfigObject({
  hub,
  config,
}: {
  hub?: string
  config?: string
}) {
  if (hub) {
    return fetchConfig(hubToConfigUrl(hub), `Failed to fetch --hub "${hub}"`)
  }
  if (config && isUrl(config)) {
    return fetchConfig(config, `Failed to fetch --config "${config}"`)
  }
  return undefined
}
