// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from '@testing-library/react'
import { types, getSnapshot } from 'mobx-state-tree'
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
  return types.model('LinearSyntenyView', {
    type: 'LinearSyntenyView',
    views: types.array(types.frozen()),
    tracks: types.array(stateModelFactory(pluginManager, configSchema)),
  })
}
const createSyntenyTrack = () =>
  // @ts-ignore
  getView().create({
    tracks: [
      {
        configuration: {
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
        },
        renderDelay: 100,
        syntenyBlocks: { key: 'test' },
        type: 'LinearSyntenyTrack',
      },
    ],
  })

// function timeout(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }
test('test rendering synteny data', async () => {
  const view = createSyntenyTrack()

  const { findByTestId, container } = render(
    <LinearSyntenyTrack model={view.tracks[0]} />,
  )
  await findByTestId('loading-synteny')

  expect(container).toMatchSnapshot()
  expect(1).toBe(1)
})
