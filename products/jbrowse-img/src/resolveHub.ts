import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { hubUrl } from '@jbrowse/core/util/fetchHub'

import type { Config } from './types.ts'

// jbrowse.org hosts a self-contained config.json per assembly: the assembly
// (remote 2bit sequence, refNameAliases, cytobands, geneticCodes) plus its full
// track set, all as remote URIs. `--hub` pulls one of these so a user gets
// cytobands/aliasing/hosted trackIds without hand-wiring --fasta/--aliases. The
// token -> URL mapping is core's (shared with the embedded mounts).

function isUrl(str: string) {
  return /^https?:\/\//i.test(str)
}

// Fetch a config.json and inject it as an object. `hint` is appended to a fetch
// failure only for --hub (a bad UCSC db/GenArk token), not a --config URL (an
// arbitrary hosted config, for which an "available assemblies" pointer would be
// nonsense).
async function fetchConfig(url: string, context: string, hint = '') {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${context}: HTTP ${res.status} from ${url}.${hint}`)
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
// (resolved to its jbrowse.org URL) or a --config that is itself a URL. Returns
// undefined when neither applies, so readData falls back to its local --config
// file read.
export async function resolveConfigObject({
  hub,
  config,
}: {
  hub?: string
  config?: string
}) {
  if (hub) {
    return fetchConfig(
      hubUrl(hub),
      `Failed to fetch --hub "${hub}"`,
      ' See https://jbrowse.org for available assemblies.',
    )
  }
  if (config && isUrl(config)) {
    return fetchConfig(config, `Failed to fetch --config "${config}"`)
  }
  return undefined
}
