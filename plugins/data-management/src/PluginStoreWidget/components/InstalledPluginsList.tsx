import React from 'react'
import { observer } from 'mobx-react'
import { List, Typography } from '@material-ui/core'
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
  const { plugins } = pluginManager as PluginManager

  const corePlugins = plugins
    .filter(p => pluginManager.pluginMetadata[p.name]?.isCore)
    .map(p => p.name)

  const externalPlugins = plugins.filter(
    plugin => !corePlugins.includes(plugin.name),
  )

  return (
    <List>
      {externalPlugins.length ? (
        externalPlugins
          .filter(plugin =>
            plugin.name.toLowerCase().includes(model.filterText.toLowerCase()),
          )
          .map(plugin => (
            <InstalledPlugin key={plugin.name} plugin={plugin} model={model} />
          ))
      ) : (
        <Typography>No plugins currently installed</Typography>
      )}
    </List>
  )
}

export default observer(InstalledPluginsList)
