import React from 'react'
import getValue from '@gmod/jbrowse-core/value'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import JBrowseRootModelFactory from './rootModel'
import corePlugins from './corePlugins'

import JBrowse from './JBrowse'

import configSnapshot from '../test_data/volvox/config.json'

function getPluginManager(initialState = {}, adminMode = false) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pluginManager, adminMode)
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

export default function JBrowseDemo() {
  const pluginManager = getPluginManager()
  return <JBrowse pluginManager={pluginManager} />
}
