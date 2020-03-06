// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from '@testing-library/react'
import { types } from 'mobx-state-tree'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import React from 'react'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  AdapterClass as NCListAdapter,
  configSchema as nclistAdapterConfigSchema,
} from '@gmod/jbrowse-plugin-jbrowse1/src/NCListAdapter'
import LinearSyntenyTrack from './LinearSyntenyTrack'
import {
  AdapterClass as MCScanAnchorsAdapter,
  configSchema as mcscanAdapterConfigSchema,
} from '../../MCScanAnchorsAdapter'
import { stateModelFactory, configSchemaFactory } from '..'

class MCScanAdapterPlugin extends Plugin {
  // @ts-ignore
  install(pluginManager: any) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanAnchorsAdapter',
          AdapterClass: MCScanAnchorsAdapter,
          configSchema: mcscanAdapterConfigSchema,
        }),
    )
  }
}

class NCListAdapterPlugin extends Plugin {
  // @ts-ignore
  install(pluginManager: any) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'NCListAdapter',
          AdapterClass: NCListAdapter,
          configSchema: nclistAdapterConfigSchema,
        }),
    )
  }
}

class FakeTrackAndViewPlugin extends Plugin {
  // @ts-ignore
  install(pluginManager: any) {
    const FakeTrack = types
      .model('FakeTrack', {
        trackId: 'FakeTrack',
        type: 'FakeTrack',
        features: types.frozen(),
        layoutFeatures: types.frozen(),
        configuration: types.frozen(),
      })
      .actions(self => ({
        afterCreate() {
          self.features = new Map(Object.entries(self.features))
          self.layoutFeatures = new Map(Object.entries(self.layoutFeatures))
        },
      }))
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'LinearGenomeView',
          stateModel: types
            .model('LinearGenomeView', {
              type: 'LinearGenomeView',
              tracks: types.array(FakeTrack),
            })
            .views(self => ({
              getTrack(trackConfigId: string) {
                return self.tracks.find(
                  t => t.configuration.trackId === trackConfigId,
                )
              },
            })),
          ReactComponent,
          RenderingComponent: true,
        }),
    )
  }
}
const ReactComponent = () => <p>Hello World</p>
const getView = () => {
  const pluginManager = new PluginManager([
    new MCScanAdapterPlugin(),
    new NCListAdapterPlugin(),
    new FakeTrackAndViewPlugin(),
  ])

  pluginManager.configure()
  const configSchema = configSchemaFactory(pluginManager)
  const stateModel = stateModelFactory(pluginManager, configSchema)
  return { stateModel, configSchema }
}

test('test', () => {
  const { stateModel, configSchema } = getView()
  const configuration = configSchema.create({
    trackId: 'trackId0',
    name: 'synteny',
    type: 'LinearSyntenyTrack',
    adapter: {
      type: 'MCScanAnchorsAdapter',
      assemblyNames: ['peach', 'grape'],
      mcscanAnchorsLocation: {
        uri: 'test_data/grape.peach.anchors',
      },
      subadapters: [
        {
          rootUrlTemplate:
            'https://s3.amazonaws.com/jbrowse.org/genomes/synteny/peach_gene/{refseq}/trackData.json',
        },
        {
          rootUrlTemplate:
            'https://s3.amazonaws.com/jbrowse.org/genomes/synteny/grape_gene/{refseq}/trackData.json',
        },
      ],
    },
  })

  // @ts-ignore
  const model = stateModel.create({
    configuration,
    renderDelay: 100,
    syntenyBlocks: { key: 'test' },
    type: 'LinearSyntenyTrack',
  })
  const { container } = render(<LinearSyntenyTrack model={model} />)
  expect(container).toMatchSnapshot()
  expect(1).toBe(1)
})
