import {
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
  const { data: plugins, error } = useFetch(
    'jbrowse-plugin-store',
    async () => {
      const res = await fetch('https://jbrowse.org/plugin-store/plugins.json')
      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status} fetching plugins: ${await res.text()}`,
        )
      }
      const json = (await res.json()) as { plugins: JBrowsePlugin[] }
      return json.plugins
    },
  )
  return { plugins, error }
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
