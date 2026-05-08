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
  const { data, error } = useFetch('jbrowse-plugin-store', () =>
    fetchJson<{ plugins: JBrowsePlugin[] }>(
      'https://jbrowse.org/plugin-store/plugins.json',
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
