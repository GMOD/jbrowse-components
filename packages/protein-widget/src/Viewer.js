import React from 'react'
import ReactDOM from 'react-dom'
import { Provider } from 'mobx-react'

import { types } from 'mobx-state-tree'

import PluginManager from '../../jbrowse-web/src/PluginManager'
import RpcManager from '../../jbrowse-web/src/rpc/RpcManager'

import LinearGenomeViewPlugin from '../../jbrowse-web/src/plugins/LinearGenomeView'
import FromConfigAdapterPlugin from '../../jbrowse-web/src/plugins/FromConfigAdapter'
import DivSequenceRendererPlugin from '../../jbrowse-web/src/plugins/DivSequenceRenderer'
import { ConfigurationSchema } from '../../jbrowse-web/src/configuration'

const plugins = [
  FromConfigAdapterPlugin,
  LinearGenomeViewPlugin,
  DivSequenceRendererPlugin,
]

// want a lineargenomeview with a sequence track
// and a variants track
export class Viewer {
  constructor(domElement, initialState = {}) {
    this.pluginManager = new PluginManager(plugins).configure()
    const LinearGenomeViewType = this.pluginManager.getViewType(
      'LinearGenomeView',
    )
    const BasicTrackType = this.pluginManager.getTrackType('BasicTrack')

    const widgetWidth = 800
    this.model = types
      .model({
        view: LinearGenomeViewType.stateModel,
        sequenceTrackConfig: BasicTrackType.configSchema,
        configuration: ConfigurationSchema('ProteinViewer', {
          rpc: RpcManager.configSchema,
        }),
      })
      .volatile(() => ({
        pluginManager: this.pluginManager,
        app: this,
      }))
      .create({
        view: {
          type: 'LinearGenomeView',
          hideControls: true,
          width: widgetWidth,
        },
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      })
    this.rpcManager = new RpcManager(
      this.pluginManager,
      this.model.configuration.rpc,
    )

    if (initialState.region) {
      this.model.view.displayRegions([initialState.region])
    }

    this.model.view.showTrack(this.model.sequenceTrackConfig)

    ReactDOM.render(
      <Provider rootModel={this.model}>
        <LinearGenomeViewType.ReactComponent model={this.model.view} />
      </Provider>,
      domElement,
    )
  }

  update(newState) {}
}

// function ensure(thing) {
//   if (!thing) {
//     debugger
//     throw new Error('assertion failed')
//   }
//   return thing
// }
