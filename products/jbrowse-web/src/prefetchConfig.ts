import { readQueryParams } from '@jbrowse/app-core'

import { resolveConfigPath } from './resolveConfigPath.ts'

let early: { configPath: string; config: Promise<unknown> } | undefined

/**
 * Take the config `index.html` requested as it parsed, or request it from
 * main.js, beside the app's own chunks, instead of after the session loader's
 * chunks have downloaded and run. The loader takes the parsed config with
 * {@link takePrefetchedConfig}; anything but a good response is dropped, and
 * the loader's own fetch then reports the failure as it always has.
 */
export function prefetchConfig() {
  const configPath = resolveConfigPath(readQueryParams(['config']).config)
  const fromHtml = window.__jbrowseEarlyConfig
  window.__jbrowseEarlyConfig = undefined
  if (configPath === 'none') {
    return
  }
  early =
    fromHtml?.configPath === configPath
      ? fromHtml
      : {
          configPath,
          config: fetch(
            configPath +
              (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : ''),
          )
            .then(r => (r.ok ? r.json() : undefined))
            .catch(() => undefined),
        }
}

/** The prefetched config for `configPath`, once; a plugin reload fetches anew */
export async function takePrefetchedConfig(configPath: string) {
  const entry = early
  early = undefined
  return entry?.configPath === configPath ? entry.config : undefined
}
