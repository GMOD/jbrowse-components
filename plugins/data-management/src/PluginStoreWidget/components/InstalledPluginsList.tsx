import { installedVersionFromUrl } from '@jbrowse/core/util'
import { List, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import InstalledPlugin from './InstalledPlugin.tsx'

import type { PluginStoreModel } from '../model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

const InstalledPluginsList = observer(function InstalledPluginsList({
  pluginManager,
  model,
  storePlugins,
}: {
  pluginManager: PluginManager
  model: PluginStoreModel
  storePlugins?: JBrowsePlugin[]
}) {
  const { plugins } = pluginManager
  const { filterText } = model

  const externalPlugins = plugins.filter(
    p => !pluginManager.pluginMetadata[p.name]?.isCore,
  )

  return (
    <List>
      {externalPlugins.length > 0 ? (
        externalPlugins
          .filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()))
          .map(p => {
            // match the store entry by the v2 identity (packageName embedded in
            // the version-pinned install url), not by display name: a plugin's
            // runtime name is its Plugin class name (e.g. "GWASPlugin") while
            // the store name is the UMD global (e.g. "GWAS"), so a name compare
            // misses for almost every plugin and no update is ever offered.
            const installedUrl = pluginManager.pluginMetadata[p.name]?.url
            const storeEntry = storePlugins?.find(
              s =>
                s.packageName !== undefined &&
                installedVersionFromUrl(installedUrl, s.packageName) !==
                  undefined,
            )
            return (
              <InstalledPlugin
                key={p.name}
                plugin={p}
                model={model}
                storeEntry={storeEntry}
              />
            )
          })
      ) : (
        <Typography>No plugins currently installed</Typography>
      )}
    </List>
  )
})

export default InstalledPluginsList
