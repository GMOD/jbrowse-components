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
import IndexedFastaAdapterPlugin from './plugins/IndexedFastaAdapter'
import BigWigAdapterPlugin from './plugins/BigWigAdapter'
import FromConfigAdapterPlugin from './plugins/FromConfigAdapter'

// tracks
import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import SequenceTrackPlugin from './plugins/SequenceTrack'
import FilteringTrackPlugin from './plugins/FilteringTrack'

// views
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'
import DataHubManagerDrawerWidgetPlugin from './plugins/DataHubManagerDrawerWidget'

// renderers
import PileupRendererPlugin from './plugins/PileupRenderer'
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import DivSequenceRendererPlugin from './plugins/DivSequenceRenderer'
import WiggleRendererPlugin from './plugins/WiggleRenderer'

// configs
import ConfigurationEditorPlugin from './plugins/ConfigurationEditorDrawerWidget'
import WorkerManager from './WorkerManager'
import RpcManager from './rpc/RpcManager'

const corePlugins = [
  MainMenuBarPlugin,
  HierarchicalTrackSelectorDrawerWidgetPlugin,
  BamAdapterPlugin,
  TwoBitAdapterPlugin,
  IndexedFastaAdapterPlugin,
  BigWigAdapterPlugin,
  LinearGenomeViewPlugin,
  AlignmentsTrackPlugin,
  DataHubManagerDrawerWidgetPlugin,
  ConfigurationEditorPlugin,
  SequenceTrackPlugin,
  PileupRendererPlugin,
  SvgFeaturePlugin,
  DivSequenceRendererPlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  WiggleRendererPlugin,
]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  constructor() {
    this.pluginManager = new PluginManager(corePlugins)
    this.workerManager = new WorkerManager()
  }

  addPlugin(plugin) {
    // just delegates to the plugin manager
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

    // rpc isn't connected until our configuration is loaded
    this.rpcManager = new RpcManager(this.model.configuration.rpc, {
      WebWorkerRpcDriver: {
        workers: this.workerManager.getWorkerGroup('rpc'),
      },
    })

    this.configured = true
    return this
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
