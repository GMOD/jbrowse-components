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
import '../../jbrowse-web/src/fonts/material-icons.css'

const plugins = [
  FromConfigAdapterPlugin,
  LinearGenomeViewPlugin,
  SequenceRendererPlugin,
]

// want a lineargenomeview with a sequence track
// and a variants track
export class Viewer {
  constructor(domElement, initialState = {}) {
    this.pluginManager = new PluginManager(
      plugins.map(P => new P()),
    ).configure()
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
            name: 'Sequence',
            description:
              'Amino acid sequence, and the underlying DNA sequence if available',
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
      this.updateSequences(protein)
    })
  }

  /**
   * updates the displayed region, and the sequences used in the sequences track
   *
   * @param {object} protein
   */
  updateSequences({ sequences, name }) {
    const aaSequence = sequences.aminoAcid.replace(/\s/g, '')
    const dnaSequence = sequences.translatedDna.replace(/\s/g, '')
    const features = []
    if (dnaSequence)
      features.push({
        uniqueId: 'dna-ref',
        start: 0,
        end: dnaSequence.length / 3, // we are doing things in aa seq coordinates
        seq: dnaSequence,
        seq_id: name,
        type: 'dna',
      })
    if (aaSequence) {
      features.push({
        uniqueId: 'protein-ref',
        start: 0,
        end: aaSequence.length,
        seq: aaSequence,
        seq_id: name,
        type: 'protein',
      })
    } else if (dnaSequence) {
      // TODO: generate the AA sequence by translating the DNA sequence
    }
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
    this.model.configuration.sequenceTrack.adapter.features.set(features)
  }
}
