import fs from 'node:fs'
import path from 'node:path'

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

function indexFileOf(track: { textSearching?: unknown } | undefined) {
  const localPath = (
    track?.textSearching as
      | { textSearchAdapter?: { ixFilePath?: { localPath?: string } } }
      | undefined
  )?.textSearchAdapter?.ixFilePath?.localPath
  return localPath === undefined ? undefined : path.basename(localPath)
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
  expect(indexFileOf(getSnapshot(root.session.sessionTracks[0]))).toBe(
    'session_genes-index.ix',
  )
  expect(indexFileOf(root.session.getTrackById('session_genes'))).toBe(
    'session_genes-index.ix',
  )
  expect(indexFileOf(root.jbrowse.tracks[0])).toBeUndefined()
})

// the session's history records the index like any other session edit, so
// undo has to be able to take it back out of the entry
test('undo and redo step over a session track index', async () => {
  const root = createRoot()
  spyOnRpc(root)
  const history = root.history
  await jest.advanceTimersByTimeAsync(QUEUE_DELAY_MS)
  const entryIndex = () =>
    indexFileOf(getSnapshot(root.session.sessionTracks[0]))

  await runIndexJob(root, 'session_genes')
  // the history records a change once the session has been quiet for 300ms
  await jest.advanceTimersByTimeAsync(QUEUE_DELAY_MS)
  expect(history.canUndo).toBe(true)

  history.undo()
  expect(entryIndex()).toBeUndefined()

  history.redo()
  expect(entryIndex()).toBe('session_genes-index.ix')
})

test('indexing a config track writes the index into jbrowse.tracks', async () => {
  const root = createRoot()
  spyOnRpc(root)
  await runIndexJob(root, 'config_genes')

  expect(indexFileOf(root.jbrowse.tracks[0])).toBe('config_genes-index.ix')
  expect(
    indexFileOf(getSnapshot(root.session.sessionTracks[0])),
  ).toBeUndefined()
})
