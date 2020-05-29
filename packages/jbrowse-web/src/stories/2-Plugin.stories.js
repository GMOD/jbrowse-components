import React from 'react'
import { action } from '@storybook/addon-actions'
import { Button } from '@storybook/react/demo'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import corePlugins from '../corePlugins'
import JBrowse from '../JBrowse'
import JBrowseRootModelFactory from '../rootModel'
import configSnapshot from '../../test_data/volvox/config.json'

configSnapshot.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
  useUrlSession: false,
}
export default {
  title: 'PluginManager',
  component: Button,
}

function getPluginManager(initialState) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager)
  const rootModel = JBrowseRootModel.create({
    jbrowse: initialState || configSnapshot,
    assemblyManager: {},
  })
  if (rootModel.jbrowse && rootModel.jbrowse.savedSessions.length) {
    const { name } = rootModel.jbrowse.savedSessions[0]
    rootModel.activateSession(name)
  } else {
    rootModel.setDefaultSession()
  }
  pluginManager.setRootModel(rootModel)

  pluginManager.configure()
  return pluginManager
}
export const Text = () => {
  const pluginManager = getPluginManager()
  return <JBrowse pluginManager={pluginManager} />
}
