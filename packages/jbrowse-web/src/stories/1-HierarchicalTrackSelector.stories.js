import React from 'react'
import { Button } from '@storybook/react/demo'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import TrackSelector from '@gmod/jbrowse-plugin-data-management/src/HierarchicalTrackSelectorDrawerWidget/components/HierarchicalTrackSelector'

import corePlugins from '../corePlugins'
import JBrowse from '../JBrowse'
import JBrowseRootModelFactory from '../rootModel'
import configSnapshot from '../../test_data/volvox/config.json'
import breakpointConfig from '../../test_data/breakpoint/config.json'

configSnapshot.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
  useUrlSession: false,
}
export default {
  title: '<HierarchicalTrackSelectorDrawerWidget>',
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

export const DefaultConfig = () => {
  const pluginManager = getPluginManager()
  return <TrackSelector model={pluginManager.rootModel} />
}
