import { createJbApi } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'
import rootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from '../sessionModel/sessionModel.ts'

import type { LinearCanvasBaseDisplayModel } from '@jbrowse/plugin-canvas/LinearBasicDisplay/baseStateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

function appWithGeneTrack() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const root = rootModelFactory({ pluginManager, sessionModelFactory }).create(
    {
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: {
                type: 'FromConfigSequenceAdapter',
                features: [
                  { refName: 'ctgA', uniqueId: 'ctgA', start: 0, end: 1000 },
                ],
              },
            },
          },
        ],
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'genes',
            assemblyNames: ['volvox'],
            adapter: { type: 'FromConfigAdapter', features: [] },
          },
        ],
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(root)
  pluginManager.configure()
  root.setSession({ name: 'test' })
  root.session!.addView('LinearGenomeView', {})
  return createJbApi(pluginManager)
}

test('a feature track groups, colors and filters through its display, and reads the channels back', async () => {
  const jb = appWithGeneTrack()
  await (jb.view() as LinearGenomeViewModel).launchTrack('genes')
  const display = jb.trackModel('genes')
    .activeDisplay as unknown as LinearCanvasBaseDisplayModel
  display.applyChannelSpec({
    facet: { field: 'strand' },
    color: { field: 'gene_biotype', domain: ['protein_coding'] },
    filter: ["feature.type == 'gene'"],
  })
  expect(display.channelSpec).toEqual({
    facet: { field: 'strand' },
    color: { field: 'gene_biotype', domain: ['protein_coding'] },
    filter: ["feature.type == 'gene'"],
  })
  expect(jb.getConf(display, 'facetField')).toBe('strand')
  display.applyChannelSpec({ facet: null })
  expect(display.channelSpec.facet).toBeNull()
})
