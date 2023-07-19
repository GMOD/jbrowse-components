import React from 'react'
import { observer } from 'mobx-react'
import { List, Typography } from '@mui/material'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { PluginStoreModel } from '../model'
import InstalledPlugin from './InstalledPlugin'

export default observer(function InstalledPluginsList({
  pluginManager,
  model,
}: {
  pluginManager: PluginManager
  model: PluginStoreModel
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
          .map(p => <InstalledPlugin key={p.name} plugin={p} model={model} />)
      ) : (
        <Typography>No plugins currently installed</Typography>
      )}
    </List>
  )
})
