import React from 'react'
import ReactDOM from 'react-dom'
import { toArray } from 'rxjs/operators'
import { transaction } from 'mobx'
import { Provider } from 'mobx-react'
import { types } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import 'typeface-roboto'
import '@gmod/jbrowse-core/fonts/material-icons.css'

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'

import Config from '@gmod/jbrowse-plugin-config'
import Protein from '@gmod/jbrowse-plugin-protein'
import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'
import Lollipop from '@gmod/jbrowse-plugin-lollipop'
import SVG from '@gmod/jbrowse-plugin-svg'
import Filtering from '@gmod/jbrowse-plugin-filtering'
import GranularRectLayout from '@gmod/jbrowse-core/util/layouts/GranularRectLayout'
import Rendering from '@gmod/jbrowse-plugin-svg/src/SvgFeatureRenderer/components/SvgFeatureRendering'
import SvgRendererConfigSchema from '@gmod/jbrowse-plugin-svg/src/SvgFeatureRenderer/configSchema'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import {
  AdapterClass,
  configSchema as ConfigSchema,
} from '@gmod/jbrowse-plugin-jbrowse1/src/NCListAdapter'
import * as rpcFuncs from './rpcMethods'

const plugins = [Config, LinearGenomeView, Protein, Lollipop, SVG, Filtering]

// want a lineargenomeview with a sequence track
// and a variants track
export class ProteinWidget {
  constructor(initialState = {}) {
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
    this.ReactComponent = LinearGenomeViewType.ReactComponent
    this.model = types
      .model({
        view: LinearGenomeViewType.stateModel,
        configuration: ConfigurationSchema('ProteinViewer', {
          assembly: ConfigurationSchema('ProteinAssembly', {
            name: { type: 'string', defaultValue: 'protein' },
          }),
          rpc: RpcManager.configSchema,
          sequenceTrack: BasicTrackType.configSchema,
          variantTrack: DynamicTrackType.configSchema,
          domainsTrack: FilteringTrackType.configSchema,
        }),
      })
      .volatile(self => ({
        pluginManager: this.pluginManager,
        rpcManager: new RpcManager(this.pluginManager, self.configuration.rpc, {
          MainThreadRpcDriver: { rpcFuncs },
        }),
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
            renderer: { type: 'ProteinReferenceSequenceTrackRenderer' },
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

    this.update(initialState)

    this.model.view.showTrack(this.model.configuration.sequenceTrack)
    this.model.view.showTrack(this.model.configuration.domainsTrack, {
      height: 300,
    })
    this.model.view.showTrack(this.model.configuration.variantTrack, {
      height: 300,
    })
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
        refName: name,
        type: 'dna',
      })
    if (aaSequence) {
      features.push({
        uniqueId: 'protein-ref',
        start: 0,
        end: aaSequence.length,
        seq: aaSequence,
        refName: name,
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

export function ProteinViewer({ widget }) {
  return (
    <Provider session={widget.model}>
      <widget.ReactComponent model={widget.model.view} />
    </Provider>
  )
}

ProteinViewer.propTypes = {
  widget: PropTypes.instanceOf(ProteinWidget).isRequired,
}

export function ProteinViewerRender(domElement, widget) {
  ReactDOM.render(<ProteinViewer widget={widget} />, domElement)
}

const FeatureRendering = ({ features, region, width, height }) => (
  <Rendering
    width={width}
    height={height}
    region={region}
    layout={new GranularRectLayout({ pitchX: 1, pitchY: 1 })}
    features={features}
    config={SvgRendererConfigSchema.create({})}
    bpPerPx={(region.end - region.start) / width}
  />
)
FeatureRendering.propTypes = {
  features: PropTypes.arrayOf(PropTypes.shape()).isRequired,
  region: PropTypes.shape().isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
}

export function ExampleFeatureRendering(domElement) {
  const region = {
    refName: 'chr1',
    start: 1,
    end: 100,
  }
  const feat1 = new SimpleFeature({
    id: 'feat1',
    data: {
      refName: 'chr1',
      name: 'BRCA1',
      start: 5,
      end: 90,
    },
  })
  const feat2 = new SimpleFeature({
    id: 'feat2',
    data: {
      refName: 'chr1',
      name: 'BRCA2',
      start: 30,
      end: 95,
    },
  })
  const x = new Map()

  ReactDOM.render(
    <FeatureRendering
      features={[feat1, feat2]}
      width={800}
      height={200}
      region={region}
    />,
    domElement,
  )
}

export async function NclistFeatureRendering(domElement) {
  const region = {
    refName: 'chr17',
    start: 41190000,
    end: 41280000,
  }
  const adapter = new AdapterClass({
    rootUrlTemplate: '../test_data/brca_nclist/{refseq}/trackData.json',
  })
  const ret = adapter.getFeatures(region)
  const feats = await ret.pipe(toArray()).toPromise()

  ReactDOM.render(
    <FeatureRendering
      features={feats}
      width={800}
      height={200}
      region={region}
    />,
    domElement,
  )
}
