import { hubUrl } from '@jbrowse/core/util/fetchHub'
import { addRelativeUris } from '@jbrowse/product-core'

import type { Config } from './types.ts'

// genomes.jbrowse.org hosts a self-contained config.json per assembly: the
// assembly (remote 2bit sequence, refNameAliases, cytobands, geneticCodes) plus
// its full track set, all as remote URIs. `--hub` pulls one of these so a user
// gets cytobands/aliasing/hosted trackIds without hand-wiring --fasta/--aliases.
// The token -> URL mapping is core's (shared with the embedded mounts).

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
    return fetchConfig(hubUrl(hub), `Failed to fetch --hub "${hub}"`)
  }
  if (config && isUrl(config)) {
    return fetchConfig(config, `Failed to fetch --config "${config}"`)
  }
  return undefined
}
