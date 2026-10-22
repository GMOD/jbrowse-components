import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { isUrl } from '@jbrowse/launch-args'

import type { Config } from './types.ts'

// genomes.jbrowse.org hosts a self-contained config.json per assembly: the
// assembly (remote 2bit sequence, refNameAliases, cytobands, geneticCodes) plus
// its full track set, all as remote URIs. `--genome` pulls one of these so a user
// gets cytobands/aliasing/hosted trackIds without hand-wiring a genome file.
// The fetch is core's fetchHub (shared with the embedded mounts), which also
// stamps each relative URI with the config URL as baseUri.

// fetch has no timeout of its own, and a stalled connection otherwise hangs
// the command forever
export const FETCH_TIMEOUT_MS = 30000

// Fetch a --config that is itself a URL. Same baseUri stamping as fetchHub:
// jbrowse-web resolves relative URIs because it loads the config from a URL;
// here the config is injected as an object, so resolveUriLocation needs the
// baseUri written on each location.
async function fetchConfig(url: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(
      `Failed to fetch --config "${url}": HTTP ${res.status} from ${url}.`,
    )
  }
  const config = (await res.json()) as Config
  addRelativeUris(config, new URL(url))
  return config
}

// Fetch the config object when it must come off the network: a --genome token
// (resolved to its jbrowse.org URL) or a --config that is itself a URL.
// Returns undefined when neither applies, so readData falls back to its local
// --config file read.
export async function resolveConfigObject({
  genome,
  config,
}: {
  genome?: string
  config?: string
}) {
  if (genome && config) {
    throw new Error(
      'pass --genome or --config, not both (a --genome is a complete config)',
    )
  }
  if (genome) {
    // the same open-record force the --config read applies: `assembly` is
    // filled in by readData, which is the only consumer
    return (await fetchHub(genome, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })) as unknown as Config
  }
  if (config && isUrl(config)) {
    if (!/^https?:\/\//i.test(config)) {
      throw new Error(
        `--config ${config}: JBrowse fetches a config over http or https, or reads one from a file`,
      )
    }
    return fetchConfig(config)
  }
  return undefined
}
