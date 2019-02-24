import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'mobx-react'

import PluginManager from './PluginManager'

import App from './ui/App'
import RootModelFactory from './rootModel'
import MainMenuBarPlugin from './plugins/MainMenuBar'

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

// renderers
import PileupRendererPlugin from './plugins/PileupRenderer'
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import DivSequenceRendererPlugin from './plugins/DivSequenceRenderer'
import WiggleRendererPlugin from './plugins/WiggleRenderer'

// drawer widgets
import HierarchicalTrackSelectorDrawerWidgetPlugin from './plugins/HierarchicalTrackSelectorDrawerWidget'
import DataHubManagerDrawerWidgetPlugin from './plugins/DataHubManagerDrawerWidget'
import AddTrackDrawerWidgetPlugin from './plugins/AddTrackDrawerWidget'
import ConfigurationEditorPlugin from './plugins/ConfigurationEditorDrawerWidget'
import WorkerManager from './WorkerManager'
import RpcManager from './rpc/RpcManager'
import LollipopRendererPlugin from './plugins/LollipopRenderer'

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
  AddTrackDrawerWidgetPlugin,
  ConfigurationEditorPlugin,
  SequenceTrackPlugin,
  PileupRendererPlugin,
  SvgFeaturePlugin,
  DivSequenceRendererPlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  WiggleRendererPlugin,
  LollipopRendererPlugin,
]

// the main class used to configure and start a new JBrowse app
class JBrowse {
  constructor() {
    this.pluginManager = new PluginManager(corePlugins.map(P => new P()))
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
    this.rpcManager = new RpcManager(
      this.pluginManager,
      this.model.configuration.rpc,
      {
        WebWorkerRpcDriver: {
          workers: this.workerManager.getWorkerGroup('rpc'),
        },
      },
    )

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
