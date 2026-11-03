import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { isUrl } from '@jbrowse/launch-args'

import type { Assembly, ConfigFile } from './types.ts'
import type { HostedConfig } from '@jbrowse/launch-args'

// genomes.jbrowse.org hosts a self-contained config.json per assembly: the
// assembly (remote 2bit sequence, refNameAliases, cytobands, geneticCodes) plus
// its full track set, all as remote URIs. `--genome` pulls one of these so a user
// gets cytobands/aliasing/hosted trackIds without hand-wiring a genome file.
// The fetch is core's fetchHub (shared with the embedded mounts), which also
// stamps each relative URI with the config URL as baseUri.

// fetch has no timeout of its own, and a stalled connection otherwise hangs
// the command forever
const FETCH_TIMEOUT_MS = 30000

export async function fetchJson(url: string, context: string) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`${context}: HTTP ${res.status} from ${url}`)
  }
  return res.json() as Promise<unknown>
}

function fetchHostedConfig(name: string) {
  return fetchHub(name, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }) as Promise<ConfigFile>
}

// Same baseUri stamping as fetchHub: the config is injected as an object, so
// resolveUriLocation needs the baseUri written on each location.
async function fetchConfig(url: string) {
  const config = (await fetchJson(
    url,
    `Failed to fetch --config "${url}"`,
  )) as ConfigFile
  addRelativeUris(config, new URL(url))
  return config
}

/** Each of a comparative view's `--genome` configs, keyed by its name. */
export async function fetchHostedGenomes(names: string[]) {
  return new Map<string, HostedConfig<Assembly>>(
    await Promise.all(
      names.map(async name => [name, await fetchHostedConfig(name)] as const),
    ),
  )
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
    return fetchHostedConfig(genome)
  } else if (config && isUrl(config)) {
    if (!/^https?:\/\//i.test(config)) {
      throw new Error(
        `--config ${config}: JBrowse fetches a config over http or https, or reads one from a file`,
      )
    }
    return fetchConfig(config)
  } else {
    return undefined
  }
}
