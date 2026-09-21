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

test('a feature track groups and colors through the two settings jb.help names, and describeSlots lists them', async () => {
  const jb = appWithGeneTrack()
  await (jb.view() as LinearGenomeViewModel).launchTrack('genes')
  const track = jb.trackModel('genes')
  const display = track.activeDisplay as unknown as LinearCanvasBaseDisplayModel
  expect(
    display.applyDisplaySettings({
      facet: 'strand',
      color: { field: 'gene_biotype', domain: ['protein_coding'] },
    }),
  ).toMatchObject({ applied: ['facet', 'color'], failed: [] })
  expect(display.channelSpec).toMatchObject({
    facet: { field: 'strand' },
    color: { field: 'gene_biotype', domain: ['protein_coding'] },
  })
  expect(jb.getConf(display, 'facet')).toEqual({ field: 'strand' })
  display.applyDisplaySettings({ facet: null })
  expect(display.channelSpec.facet).toBeNull()
  expect(
    display.applyDisplaySettings({ color: { field: 'x', scale: 'ld' } }).failed,
  ).toMatchObject([{ key: 'color' }])

  const slots = jb.describeSlots(display.configuration)
  expect(slots.facet).toMatchObject({
    type: 'Facet',
    shorthand: 'field',
    slots: { field: { type: 'featureField' }, domain: { type: 'stringArray' } },
  })
  expect(slots.color).toMatchObject({
    type: 'FeatureColor',
    shorthand: 'value',
  })
})
