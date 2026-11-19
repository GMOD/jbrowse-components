import { loadSessionSpec } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const rootModel = rootModelFactory({
    pluginManager,
    sessionModelFactory,
  }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            trackId: 'volvox_refseq',
            type: 'ReferenceSequenceTrack',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                { refName: 'ctgA', uniqueId: 'a', start: 0, end: 50_000 },
              ],
            },
          },
        },
      ],
    },
  })
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return { pluginManager, rootModel }
}

test("a spec's view id and zoomOf reach the session and its snapshot", async () => {
  const { pluginManager, rootModel } = setup()
  const closeUp = {
    type: 'LinearGenomeView',
    id: 'closeUp',
    zoomOf: 'overview',
    assembly: 'volvox',
    loc: 'ctgA:1000-2000',
  }

  await loadSessionSpec(
    {
      views: [
        { type: 'LinearGenomeView', id: 'overview', assembly: 'volvox' },
        closeUp,
      ],
    },
    pluginManager,
  )

  const views = rootModel.session!.views.map(v => getSnapshot(v))
  expect(views.map(v => [v.id, v.zoomOf])).toEqual([
    ['overview', undefined],
    ['closeUp', 'overview'],
  ])
})
