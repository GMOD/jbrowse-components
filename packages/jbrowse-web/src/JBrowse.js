import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'mobx-react'

import PluginManager from './PluginManager'

import App from './ui/App'
import RootModelFactory from './rootModel'
import MainMenuBarPlugin from './plugins/MainMenuBar'
import HierarchicalTrackSelectorDrawerWidgetPlugin from './plugins/HierarchicalTrackSelectorDrawerWidget'

// adapters
import BamAdapterPlugin from './plugins/BamAdapter'
import TwoBitAdapterPlugin from './plugins/TwoBitAdapter'
import FromConfigAdapterPlugin from './plugins/FromConfigAdapter'

// tracks
import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import SequenceTrackPlugin from './plugins/SequenceTrack'

// views
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'
import DataHubManagerDrawerWidgetPlugin from './plugins/DataHubManagerDrawerWidget'

// renderers
import PileupRendererPlugin from './plugins/PileupRenderer'
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import DivSequenceRendererPlugin from './plugins/DivSequenceRenderer'
import ConfigurationEditorPlugin from './plugins/ConfigurationEditorDrawerWidget'

const corePlugins = [
  MainMenuBarPlugin,
  HierarchicalTrackSelectorDrawerWidgetPlugin,
  BamAdapterPlugin,
  TwoBitAdapterPlugin,
  LinearGenomeViewPlugin,
  AlignmentsTrackPlugin,
  DataHubManagerDrawerWidgetPlugin,
  ConfigurationEditorPlugin,
  SequenceTrackPlugin,
  PileupRendererPlugin,
  SvgFeaturePlugin,
  DivSequenceRendererPlugin,
  FromConfigAdapterPlugin,
]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  workerGroups = {}

  constructor() {
    this.pluginManager = new PluginManager(corePlugins)
  }

  addPlugin(plugin) {
    this.pluginManager.addPlugin(plugin)
    return this
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
          getMenuBarType={this.pluginManager.getMenuBarType}
        />
      </Provider>,
      document.getElementById('root'),
    )
    return this
  }
}

export default JBrowse
