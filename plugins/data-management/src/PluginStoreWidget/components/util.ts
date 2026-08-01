import { pluginUrl } from '@jbrowse/core/pluginDefinitions'
import { getEnv, isSessionWithSessionPlugins } from '@jbrowse/core/util'

import type { AbstractSessionModel, BasePlugin } from '@jbrowse/core/util/types'

export { useFetchPlugins } from '@jbrowse/core/util/useFetchPlugins'

export function isSessionPlugin(
  plugin: BasePlugin,
  session: AbstractSessionModel,
) {
  const { pluginManager } = getEnv(session)
  const installedUrl = pluginManager.pluginMetadata[plugin.name]?.url
  return isSessionWithSessionPlugins(session)
    ? session.sessionPlugins.some(p => pluginUrl(p) === installedUrl)
    : false
}
