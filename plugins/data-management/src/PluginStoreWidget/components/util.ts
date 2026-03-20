import { useEffect, useState } from 'react'

import { getEnv, isSessionWithSessionPlugins } from '@jbrowse/core/util'

import type {
  AbstractSessionModel,
  BasePlugin,
  JBrowsePlugin,
} from '@jbrowse/core/util/types'

export function useFetchPlugins() {
  const [plugins, setPlugins] = useState<JBrowsePlugin[]>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const res = await fetch('https://jbrowse.org/plugin-store/plugins.json')
        if (!res.ok) {
          const err = await res.text()
          throw new Error(`HTTP ${res.status} fetching plugins: ${err}`)
        }
        const array = await res.json()
        setPlugins(array.plugins)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])
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
