/* eslint-disable react/prop-types */
import React from 'react'
import { observer } from 'mobx-react'

import List from '@material-ui/core/List'
import Typography from '@material-ui/core/Typography'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BasePlugin } from '@jbrowse/core/util/types'

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
  const corePlugins = plugins
    .filter((p: BasePlugin) =>
      Boolean(pluginManager.pluginMetaData[p.name]?.isCore),
    )
    .map((p: BasePlugin) => p.name)
  const externalPlugins = plugins.filter((plugin: BasePlugin) => {
    return !corePlugins.includes(plugin.name)
  })

  const externalPluginsRender = externalPlugins
    .filter((plugin: BasePlugin) => {
      return plugin.name.toLowerCase().includes(model.filterText.toLowerCase())
    })
    .map((plugin: BasePlugin) => {
      return <InstalledPlugin plugin={plugin} model={model} />
    })

  return (
    <List>
      {externalPlugins.length ? (
        externalPluginsRender
      ) : (
        <Typography>No plugins currently installed</Typography>
      )}
    </List>
  )
}

export default observer(InstalledPluginsList)
