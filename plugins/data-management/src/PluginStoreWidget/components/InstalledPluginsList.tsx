import React from 'react'
import { observer } from 'mobx-react'
import { List, Typography } from '@mui/material'
import PluginManager from '@jbrowse/core/PluginManager'
import { PluginStoreModel } from '../model'
import InstalledPlugin from './InstalledPlugin'

function InstalledPluginsList({
  pluginManager,
  model,
}: {
  pluginManager: PluginManager
  model: PluginStoreModel
}) {
  const { plugins } = pluginManager

  const corePlugins = new Set(
    plugins
      .filter(p => pluginManager.pluginMetadata[p.name]?.isCore)
      .map(p => p.name),
  )

  const externalPlugins = plugins.filter(
    plugin => !corePlugins.has(plugin.name),
  )

  return (
    <List>
      {externalPlugins.length > 0 ? (
        externalPlugins
          .filter(plugin =>
            plugin.name.toLowerCase().includes(model.filterText.toLowerCase()),
          )
          .map(plugin => (
            <InstalledPlugin
              key={plugin.name}
              plugin={plugin}
              model={model}
              pluginManager={pluginManager}
            />
          ))
      ) : (
        <Typography>No plugins currently installed</Typography>
      )}
    </List>
  )
}

export default observer(InstalledPluginsList)
