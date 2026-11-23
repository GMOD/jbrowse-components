import { readQueryParams } from '@jbrowse/app-core'

import { resolveConfigPath } from './resolveConfigPath.ts'

let early: Window['__jbrowseEarlyConfig']

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
    fromHtml?.configPath === configPath ? fromHtml : fetchEarly(configPath)
}

function fetchEarly(configPath: string) {
  const response = fetch(
    configPath + (window.__jbrowseCacheBuster ? `?rand=${Math.random()}` : ''),
  )
  return {
    configPath,
    config: response
      .then(r => (r.ok ? r.json() : undefined))
      .catch(() => undefined),
    url: response.then(r => r.url).catch(() => undefined),
  }
}

/** The prefetched config, without taking it from the loader */
export function prefetchedConfig() {
  return early?.config
}

/**
 * The prefetched config for `configPath` and the url it was served from, once;
 * a plugin reload fetches anew
 */
export async function takePrefetchedConfig(configPath: string) {
  const entry = early?.configPath === configPath ? early : undefined
  early = undefined
  const config: unknown = await entry?.config
  return entry && config !== undefined
    ? { config, url: await entry.url }
    : undefined
}
