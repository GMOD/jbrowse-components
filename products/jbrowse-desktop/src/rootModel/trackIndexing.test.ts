import fs from 'node:fs'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import { invokeIpc } from '../ipc.ts'
import sessionModelFactory from '../sessionModel/sessionModel.ts'
import rootModelFactory from './rootModel.ts'

jest.mock('../makeWorkerInstance.ts', () => ({
  __esModule: true,
  default: () => {},
}))
jest.mock('../ipc.ts', () => ({ invokeIpc: jest.fn() }))

const mockInvokeIpc = jest.mocked(invokeIpc)

// the job queue's autorun delay
const QUEUE_DELAY_MS = 1000

function gffTrack(trackId: string) {
  return {
    type: 'FeatureTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: `${trackId}.gff3.gz`, locationType: 'UriLocation' },
      index: {
        location: {
          uri: `${trackId}.gff3.gz.tbi`,
          locationType: 'UriLocation',
        },
      },
    },
  }
}

function createRoot() {
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
                type: 'TwoBitAdapter',
                twoBitLocation: {
                  uri: 'volvox.2bit',
                  locationType: 'UriLocation',
                },
              },
            },
          },
        ],
        tracks: [gffTrack('config_genes')],
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(root)
  pluginManager.configure()
  root.setSession({ name: 'test', sessionTracks: [gffTrack('session_genes')] })
  return root
}

function indexIdOf(track: { textSearching?: unknown } | undefined) {
  return (
    track?.textSearching as
      | { textSearchAdapter?: { textSearchAdapterId?: string } }
      | undefined
  )?.textSearchAdapter?.textSearchAdapterId
}

async function runIndexJob(
  root: ReturnType<typeof createRoot>,
  trackId: string,
) {
  root.jobsManager.queueJob({
    name: trackId,
    indexingParams: {
      attributes: ['Name'],
      exclude: [],
      assemblies: ['volvox'],
      tracks: [trackId],
      indexType: 'perTrack',
    },
  })
  await jest.advanceTimersByTimeAsync(QUEUE_DELAY_MS)
}

let rpcCall: jest.SpyInstance

beforeEach(() => {
  jest.useFakeTimers()
  mockInvokeIpc.mockReset()
  mockInvokeIpc.mockResolvedValue('/userData')
  jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function spyOnRpc(root: ReturnType<typeof createRoot>) {
  rpcCall = jest
    .spyOn(root.jbrowse.rpcManager, 'call')
    .mockResolvedValue(undefined)
}

test('indexing a session track writes the index into its session entry', async () => {
  const root = createRoot()
  spyOnRpc(root)
  await runIndexJob(root, 'session_genes')

  expect(rpcCall).toHaveBeenCalledTimes(1)
  expect(indexIdOf(getSnapshot(root.session.sessionTracks[0]))).toBe(
    'session_genes-index',
  )
  expect(indexIdOf(root.session.getTrackById('session_genes'))).toBe(
    'session_genes-index',
  )
  expect(indexIdOf(root.jbrowse.tracks[0])).toBeUndefined()
})

test('indexing a config track writes the index into jbrowse.tracks', async () => {
  const root = createRoot()
  spyOnRpc(root)
  await runIndexJob(root, 'config_genes')

  expect(indexIdOf(root.jbrowse.tracks[0])).toBe('config_genes-index')
  expect(indexIdOf(getSnapshot(root.session.sessionTracks[0]))).toBeUndefined()
})
