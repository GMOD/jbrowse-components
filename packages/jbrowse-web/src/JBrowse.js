import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'mobx-react'

import PluginManager from './PluginManager'

import App from './ui/App'
import RootModelFactory from './rootModel'
import HierarchicalTrackSelectorDrawerWidgetPlugin from './plugins/HierarchicalTrackSelectorDrawerWidget'
import BamAdapterPlugin from './plugins/BamAdapter'
import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

const corePlugins = [
  HierarchicalTrackSelectorDrawerWidgetPlugin,
  BamAdapterPlugin,
  LinearGenomeViewPlugin,
  AlignmentsTrackPlugin,
]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  workerGroups = {}

  constructor() {
    this.pluginManager = new PluginManager(corePlugins)
  }

  configure(initialConfig) {
    this.pluginManager.configure()

    this.modelType = RootModelFactory(this)
    this.model = this.modelType.create({})

    if (initialConfig) {
      this.model.configure(initialConfig)
    }

    this.configured = true
    return this
  }

  addWorkers(groups) {
    Object.entries(groups).forEach(([groupName, workers]) => {
      if (!this.workerGroups[groupName]) this.workerGroups[groupName] = []
      this.workerGroups[groupName].push(...workers)
    })
  }

  getWorkerGroup(name) {
    return this.workerGroups[name]
  }

  start() {
    ReactDOM.render(
      <Provider rootModel={this.model}>
        <App
          getViewType={this.pluginManager.getViewType}
          getDrawerWidgetType={this.pluginManager.getDrawerWidgetType}
        />
      </Provider>,
      document.getElementById('root'),
    )
    return this
  }
}

export default JBrowse
