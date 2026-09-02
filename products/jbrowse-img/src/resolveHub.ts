import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { fetchHub } from '@jbrowse/core/util/fetchHub'

import type { Config } from './types.ts'

// genomes.jbrowse.org hosts a self-contained config.json per assembly: the
// assembly (remote 2bit sequence, refNameAliases, cytobands, geneticCodes) plus
// its full track set, all as remote URIs. `--hub` pulls one of these so a user
// gets cytobands/aliasing/hosted trackIds without hand-wiring --fasta/--aliases.
// The fetch is core's fetchHub (shared with the embedded mounts), which also
// stamps each relative URI with the config URL as baseUri.

function isUrl(str: string) {
  return /^https?:\/\//i.test(str)
}

// Fetch a --config that is itself a URL. Same baseUri stamping as fetchHub:
// jbrowse-web resolves relative URIs because it loads the config from a URL;
// here the config is injected as an object, so resolveUriLocation needs the
// baseUri written on each location.
async function fetchConfig(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch --config "${url}": HTTP ${res.status} from ${url}.`,
    )
  }
  const config = (await res.json()) as Config
  addRelativeUris(config, new URL(url))
  return config
}

// Fetch the config object when it must come off the network: a --hub token
// (resolved to its jbrowse.org URL) or a --config that is itself a URL.
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
    // the same open-record force the --config read applies: `assembly` is
    // filled in by readData, which is the only consumer
    return (await fetchHub(hub)) as unknown as Config
  }
  if (config && isUrl(config)) {
    return fetchConfig(config)
  }
  return undefined
}
