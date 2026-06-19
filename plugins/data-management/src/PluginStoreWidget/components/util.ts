import {
  fetchJson,
  getEnv,
  isSessionWithSessionPlugins,
  useFetch,
} from '@jbrowse/core/util'

import type {
  AbstractSessionModel,
  BasePlugin,
  JBrowsePlugin,
} from '@jbrowse/core/util/types'

export function useFetchPlugins() {
  // v2 manifest adds per-version JBrowse compatibility ranges + integrity hashes;
  // the v1 plugins.json remains served for older clients that predate this.
  const { data, error } = useFetch('jbrowse-plugin-store-v2', () =>
    fetchJson<{ plugins: JBrowsePlugin[] }>(
      'https://jbrowse.org/plugin-store/v2/plugins.json',
    ),
  )
  return { plugins: data?.plugins, error }
}

export function isSessionPlugin(
  plugin: BasePlugin,
  session: AbstractSessionModel,
) {
  const { pluginManager } = getEnv(session)
  return isSessionWithSessionPlugins(session)
    ? session.sessionPlugins.some(
        p => pluginManager.pluginMetadata[plugin.name]?.url === p.url,
      )
    : false
}
