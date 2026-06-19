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
          .map(p => (
            <InstalledPlugin
              key={p.name}
              plugin={p}
              model={model}
              storeEntry={storePlugins?.find(s => s.name === p.name)}
            />
          ))
      ) : (
        <Typography>No plugins currently installed</Typography>
      )}
    </List>
  )
})

export default InstalledPluginsList
