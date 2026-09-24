import { readQueryParams } from '@jbrowse/app-core'

import { resolveConfigPath } from './resolveConfigPath.ts'

let early: { configPath: string; text: Promise<string | undefined> } | undefined

/**
 * Request the config from main.js, beside the app's own chunks, instead of
 * after the session loader's chunks have downloaded and run. The loader takes
 * the text with {@link takePrefetchedConfig}; anything but a good response is
 * dropped, and the loader's own fetch then reports the failure as it always has.
 */
export function prefetchConfig() {
  const configPath = resolveConfigPath(readQueryParams(['config']).config)
  if (configPath === 'none') {
    return
  }
  const uri =
    configPath + (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : '')
  early = {
    configPath,
    text: fetch(uri).then(
      r => (r.ok ? r.text() : undefined),
      () => undefined,
    ),
  }
}

/** The prefetched text for `configPath`, once; a plugin reload fetches anew */
export async function takePrefetchedConfig(configPath: string) {
  const entry = early
  early = undefined
  return entry?.configPath === configPath ? entry.text : undefined
}
