/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable monorepo/no-relative-import */
import React from 'react'
import ReactDOM from 'react-dom'
import { transaction } from 'mobx'
import { Provider } from 'mobx-react'
import { types } from 'mobx-state-tree'
import 'typeface-roboto'
import '@gmod/jbrowse-core/fonts/material-icons.css'

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'

import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'
import Config from '@gmod/jbrowse-plugin-config'
import Protein from '@gmod/jbrowse-plugin-protein'
import Lollipop from '@gmod/jbrowse-plugin-lollipop'
import SvgFeatureRendererPlugin from '../../jbrowse-web/src/plugins/SvgFeatureRenderer'
import FilteringTrackPlugin from '../../jbrowse-web/src/plugins/FilteringTrack'

const plugins = [
  Config,
  LinearGenomeView,
  Protein,
  Lollipop,
  SvgFeatureRendererPlugin,
  FilteringTrackPlugin,
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
    const DynamicTrackType = this.pluginManager.getTrackType('DynamicTrack')
    const FilteringTrackType = this.pluginManager.getTrackType('FilteringTrack')

    const widgetWidth = 800
    this.model = types
      .model({
        view: LinearGenomeViewType.stateModel,
        configuration: ConfigurationSchema('ProteinViewer', {
          rpc: RpcManager.configSchema,
          sequenceTrack: BasicTrackType.configSchema,
          variantTrack: DynamicTrackType.configSchema,
          domainsTrack: FilteringTrackType.configSchema,
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
          domainsTrack: {
            name: 'Domains',
            renderer: {
              type: 'SvgFeatureRenderer',
              color1: `
function(feature) {
  const key = feature.get('type')
  const colorNumber = key.split('').map(c => c.charCodeAt(0)).reduce((a,b) => a+b, 0) % 6
  return ['red','green','blue','cyan', 'magenta', 'black'][colorNumber]
}`,
              labels: {
                description: "function(feature) { return feature.get('type') }",
              },
            },
            adapter: { type: 'FromConfigAdapter', features: [] },
          },
          variantTrack: {
            name: 'Variants',
            renderer: {
              type: 'LollipopRenderer',
              caption: "function(f) { return f.id() + ': ' + f.get('note')}",
            },
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
    this.model.view.showTrack(this.model.configuration.domainsTrack, {
      height: 300,
    })
    this.model.view.showTrack(this.model.configuration.variantTrack, {
      height: 300,
    })

    ReactDOM.render(
      <Provider rootModel={this.model}>
        <LinearGenomeViewType.ReactComponent model={this.model.view} />
      </Provider>,
      domElement,
    )
  }

  update({ width, protein, domains, variants }) {
    transaction(() => {
      if (width) this.model.view.setWidth(width)
      this.updateSequences(protein)
      this.updateDomains(domains)
      this.updateVariants(variants)
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

    this.model.view.setDisplayedRegions([region])
    this.model.configuration.sequenceTrack.adapter.features.set(features)
  }

  updateVariants(variants) {
    this.model.configuration.variantTrack.adapter.features.set(variants || [])
  }

  updateDomains(domains) {
    this.model.configuration.domainsTrack.adapter.features.set(domains || [])
  }
}
