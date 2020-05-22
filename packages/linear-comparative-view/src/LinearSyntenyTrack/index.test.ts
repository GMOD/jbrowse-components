import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { configSchemaFactory } from './index'
import ThisPlugin from '..'

test('create config', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  expect(() =>
    configSchemaFactory(pluginManager).create({
      trackId: 'grape_peach_synteny_mcscan',
      type: 'LinearSyntenyTrack',
      assemblyNames: ['peach', 'grape'],
      trackIds: [],
      renderDelay: 100,
      adapter: {
        mcscanAnchorsLocation: {
          uri: 'test_data/grape.peach.anchors',
        },
        subadapters: [
          {
            type: 'NCListAdapter',
            rootUrlTemplate:
              'https://jbrowse.org/genomes/synteny/peach_gene/{refseq}/trackData.json',
          },
          {
            type: 'NCListAdapter',
            rootUrlTemplate:
              'https://jbrowse.org/genomes/synteny/grape_gene/{refseq}/trackData.json',
          },
        ],
        type: 'MCScanAnchorsAdapter',
      },
      renderer: {
        type: 'LinearSyntenyRenderer',
      },
      name: 'Grape peach synteny (MCScan)',
      category: ['Annotation'],
    }),
  ).not.toThrow()
})
