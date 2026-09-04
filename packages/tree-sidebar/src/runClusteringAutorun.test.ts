import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { destroy, types } from '@jbrowse/mobx-state-tree'

import { setupRunClusteringAutorun } from './runClusteringAutorun.ts'

import type { StopToken } from '@jbrowse/core/util/stopToken'

const mockNotifyError = jest.fn()

jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => ({
    initialized: true,
    assemblyNames: ['volvox'],
    dynamicBlocks: { contentBlocks: [] },
  }),
  getNotificationSink: () => ({ notifyError: mockNotifyError }),
  getRpcHost: () => ({ rpcManager: {} }),
  getSession: () => ({}),
  locStringsToRegions: () => [],
}))

jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'sessionId',
}))

const Display = types
  .model('TestClusteringDisplay', {
    runClustering: types.maybe(types.boolean),
    clusterRegion: types.maybe(types.string),
  })
  .actions(self => ({
    setRunClustering(arg?: boolean) {
      self.runClustering = arg
    },
    setClusterRegion(arg?: string) {
      self.clusterRegion = arg
    },
    openStatusStream() {
      return {
        statusCallback: () => {},
        clear: () => {},
      }
    },
  }))

// A run the test opens by hand, so a teardown can land while it is still in
// flight.
function gate() {
  const holder = { open: () => {} }
  const opened = new Promise<void>(resolve => {
    holder.open = resolve
  })
  return {
    opened,
    open: () => {
      holder.open()
    },
  }
}

// The autorun carries `{delay: 500}`, so even its first pass is scheduled.
const settle = (ms = 600) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

function setup(run: Parameters<typeof setupRunClusteringAutorun>[1]['run']) {
  const model = Display.create({ runClustering: true })
  setupRunClusteringAutorun(model, { name: 'Test', ready: () => true, run })
  return model
}

beforeEach(() => {
  mockNotifyError.mockClear()
})

test('clears the trigger once the run finishes, and releases its token', async () => {
  const seen: StopToken[] = []
  const model = setup(({ stopToken }) => {
    seen.push(stopToken)
    return Promise.resolve()
  })

  await settle()

  expect(model.runClustering).toBeUndefined()
  expect(model.clusterRegion).toBeUndefined()
  expect(() => {
    checkStopToken(seen[0])
  }).toThrow(/aborted/)
})

test('stops the in-flight token when the display is destroyed mid-run', async () => {
  const g = gate()
  const seen: StopToken[] = []
  const wrote: string[] = []
  const model = setup(async ({ stopToken }) => {
    seen.push(stopToken)
    await g.opened
    checkStopToken(stopToken)
    wrote.push('setLayoutAndClusterTree')
  })

  await settle()
  expect(seen).toHaveLength(1)

  destroy(model)
  expect(() => {
    checkStopToken(seen[0])
  }).toThrow(/aborted/)

  g.open()
  await settle(0)
  expect(wrote).toEqual([])
  expect(mockNotifyError).not.toHaveBeenCalled()
})
