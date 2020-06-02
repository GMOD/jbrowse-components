import React from 'react'
import { Button } from '@storybook/react/demo'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
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
  title: '<JBrowse>',
  component: Button,
}

function getPluginManager(jbrowse=configSnapshot) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P())).createPluggableElements()
  const rootModel = JBrowseRootModelFactory(pluginManager).create({
    jbrowse,
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
  return <JBrowse pluginManager={pluginManager} />
}

export const BreakpointConfig = () => {
  const pluginManager = getPluginManager(breakpointConfig)
  return <JBrowse pluginManager={pluginManager} />
}
