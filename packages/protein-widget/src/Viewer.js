import React from 'react'
import ReactDOM from 'react-dom'
import { transaction } from 'mobx'
import { Provider } from 'mobx-react'
import { types } from 'mobx-state-tree'

import PluginManager from '../../jbrowse-web/src/PluginManager'
import RpcManager from '../../jbrowse-web/src/rpc/RpcManager'

import LinearGenomeViewPlugin from '../../jbrowse-web/src/plugins/LinearGenomeView'
import FromConfigAdapterPlugin from '../../jbrowse-web/src/plugins/FromConfigAdapter'
import SequenceRendererPlugin from '../../jbrowse-web/src/plugins/ProteinReferenceSequenceRenderer'
import { ConfigurationSchema } from '../../jbrowse-web/src/configuration'

const plugins = [
  FromConfigAdapterPlugin,
  LinearGenomeViewPlugin,
  SequenceRendererPlugin,
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
        configuration: ConfigurationSchema('ProteinViewer', {
          rpc: RpcManager.configSchema,
          sequenceTrack: BasicTrackType.configSchema,
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
          bpPerPx: 1 / 20,
        },
        configuration: {
          rpc: { defaultDriver: 'MainThreadRpcDriver' },
          sequenceTrack: {
            renderer: { type: 'ProteinReferenceSequenceRenderer' },
            adapter: { type: 'FromConfigAdapter', features: [] },
          },
        },
      })
    this.rpcManager = new RpcManager(
      this.pluginManager,
      this.model.configuration.rpc,
    )

    this.update(initialState)

    this.model.view.showTrack(this.model.configuration.sequenceTrack)

    ReactDOM.render(
      <Provider rootModel={this.model}>
        <LinearGenomeViewType.ReactComponent model={this.model.view} />
      </Provider>,
      domElement,
    )
  }

  update({ protein }) {
    transaction(() => {
      const { sequences, name } = protein
      const aaSequence = sequences.aminoAcid.replace(/\s/g, '')
      const dnaSequence = sequences.translatedDna.replace(/\s/g, '')
      if (dnaSequence.length !== aaSequence.length * 3)
        throw new Error(
          'translatedDna sequence string must be exactly 3 times the length of the aminoAcid sequence string',
        )
      const region = {
        assemblyName: 'protein',
        refName: name,
        start: 0,
        end: aaSequence.length,
      }
      this.model.view.displayRegions([region])
      this.model.configuration.sequenceTrack.adapter.features.set([
        {
          uniqueId: 'refseq',
          start: 0,
          end: aaSequence.length,
          seq: aaSequence,
          seq_id: name,
          type: 'protein',
        },
      ])
    })
  }
}

// function ensure(thing) {
//   if (!thing) {
//     debugger
//     throw new Error('assertion failed')
//   }
//   return thing
// }
