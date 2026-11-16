import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { fetchJson, isUrl } from '@jbrowse/launch-args'

import type { Assembly, ConfigFile } from './types.ts'
import type { HostedConfig } from '@jbrowse/launch-args'

// fetch has no timeout of its own
const FETCH_TIMEOUT_MS = 30000

function fetchHostedConfig(name: string) {
  return fetchHub(name, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }) as Promise<ConfigFile>
}

// an injected config object needs baseUri written on each location, as
// fetchHub does
async function fetchConfig(url: string) {
  const config = (await fetchJson(url, `--config "${url}"`)) as ConfigFile
  addRelativeUris(config, new URL(url))
  return config
}

export async function fetchHostedGenomes(names: string[]) {
  return new Map<string, HostedConfig<Assembly>>(
    await Promise.all(
      names.map(async name => [name, await fetchHostedConfig(name)] as const),
    ),
  )
}

// undefined when the config is a local file readData reads itself
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
