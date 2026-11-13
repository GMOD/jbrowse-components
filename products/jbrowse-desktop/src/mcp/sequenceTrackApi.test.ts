import { createJbApi } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins.ts'
import rootModelFactory from '../rootModel/rootModel.ts'
import sessionModelFactory from '../sessionModel/sessionModel.ts'

jest.mock('../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

// A real session resolves an assembly's sequence track as a detached copy
// (`withSequenceEdits`), not the node inside its assembly, so these read its
// assembly by trackId rather than by position
function app() {
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
                  {
                    refName: 'ctgA',
                    uniqueId: 'ctgA',
                    start: 0,
                    end: 8,
                    seq: 'acgtttgg',
                  },
                ],
              },
            },
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

test('getFeatures on a sequence trackId reads bases without naming the assembly', async () => {
  const jb = app()
  const features = await jb.getFeatures({
    trackId: 'volvox_refseq',
    loc: 'ctgA:1-4',
  })
  expect(features.map(f => f.get('seq'))).toEqual(['acgt'])
})

test('addTrack on a sequence trackId names its assembly', async () => {
  const jb = app()
  expect(
    await jb.addTrack({ trackId: 'volvox_refseq', show: false }),
  ).toMatchObject({ trackId: 'volvox_refseq', assembly: 'volvox' })
})
