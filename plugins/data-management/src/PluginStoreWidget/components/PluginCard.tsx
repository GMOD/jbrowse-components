import { useState } from 'react'

import PluginStoreCard from '@jbrowse/core/ui/PluginStoreCard'
import {
  getEnv,
  getSession,
  isPluginInstalled,
  resolvePlugin,
} from '@jbrowse/core/util'
import { isSessionWithSessionPlugins } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'

import type { PluginStoreModel } from '../model.ts'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

const PluginCard = observer(function PluginCard({
  plugin,
  model,
}: {
  plugin: JBrowsePlugin
  model: PluginStoreModel
}) {
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const { runtimePluginDefinitions } = pluginManager

  // resolve the plugin build that matches this JBrowse version, and install
  // that concrete (version-pinned) definition rather than the raw store entry.
  // A store entry whose urls are all per-version has no definition at all once
  // no version matched — the card renders, the Install button just stays off.
  const resolved = resolvePlugin(plugin, session.version)

  const installed = isPluginInstalled(
    plugin,
    resolved,
    runtimePluginDefinitions,
  )
  const [tempDisabled, setTempDisabled] = useState(false)
  const { adminMode, jbrowse } = session
  return (
    <PluginStoreCard
      plugin={plugin}
      resolved={resolved}
      installed={installed}
      disabled={tempDisabled}
      onInstall={definition => {
        // the store's name (the UMD global) is what the definition must be
        // installed under, not the runtime Plugin class name
        const installDef = { ...definition, name: plugin.name }
        if (adminMode) {
          jbrowse.addPlugin(installDef)
        } else if (isSessionWithSessionPlugins(session)) {
          session.addSessionPlugin(installDef)
        } else {
          session.notify('No way to install plugin')
        }
        setTempDisabled(true)
      }}
    />
  )
})

export default PluginCard
