import { types } from '@jbrowse/mobx-state-tree'

import {
  installPrerequisiteFetch,
  readFor,
} from './installPrerequisiteFetch.ts'

import type { AdapterRead } from './installPrerequisiteFetch.ts'

const FIRST = { type: 'BigWigAdapter', uri: 'first.bw' }
const SECOND = { type: 'BigWigAdapter', uri: 'second.bw' }

interface Deferred {
  resolve: (v: string) => void
  reject: (e: unknown) => void
}

function makeHost() {
  return types
    .model('PrerequisiteHost', {})
    .volatile(() => ({
      isMinimized: false,
      reloadCounter: 0,
      fetchInert: false,
      adapterConfig: FIRST as Record<string, unknown>,
      read: undefined as AdapterRead<string> | undefined,
      error: undefined as unknown,
      runs: [] as Deferred[],
    }))
    .actions(self => ({
      setAdapterConfig(config: Record<string, unknown>) {
        self.adapterConfig = config
      },
      setRead(read: AdapterRead<string>) {
        self.read = read
      },
      setError(error?: unknown) {
        self.error = error
      },
    }))
    .actions(self => ({
      afterCreate() {
        installPrerequisiteFetch(self, {
          name: 'TestPrerequisite',
          delay: 0,
          report: { setStatusMessage: () => {} },
          run: () =>
            new Promise<string>((resolve, reject) => {
              self.runs.push({ resolve, reject })
            }),
          commit: read => {
            self.setRead(read)
          },
          setError: error => {
            self.setError(error)
          },
        })
      },
    }))
    .create()
}

async function flush() {
  await new Promise(resolve => setTimeout(resolve, 10))
}

test('an answer is read only while the host holds the adapter config it answers', async () => {
  const host = makeHost()
  await flush()
  host.runs[0]!.resolve('first listing')
  await flush()
  expect(host.read?.adapterConfig).toBe(FIRST)
  expect(readFor(host, host.read)).toBe('first listing')

  host.setAdapterConfig(SECOND)
  expect(readFor(host, host.read)).toBeUndefined()

  await flush()
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
  host.runs[1]!.reject(new Error('unreadable'))
  await flush()
  expect(logged).toHaveBeenCalled()
  logged.mockRestore()
  expect(host.error).toBeInstanceOf(Error)
  expect(readFor(host, host.read)).toBeUndefined()

  host.setAdapterConfig(FIRST)
  expect(readFor(host, host.read)).toBe('first listing')
})

test.each(['answers', 'fails'] as const)(
  'a read of a config the display left, which then %s, lands nothing',
  async outcome => {
    const host = makeHost()
    await flush()
    host.runs[0]!.resolve('first listing')
    await flush()

    host.setAdapterConfig(SECOND)
    await flush()
    host.setAdapterConfig({ ...FIRST })
    await flush()
    if (outcome === 'answers') {
      host.runs[1]!.resolve('second listing')
    } else {
      host.runs[1]!.reject(new Error('unreadable'))
    }
    await flush()

    expect(readFor(host, host.read)).toBe('first listing')
    expect(host.error).toBeUndefined()
    expect(host.runs).toHaveLength(2)
  },
)

test('an equal adapter config, as an undo rebuilds one, keeps the answer and reads nothing', async () => {
  const host = makeHost()
  await flush()
  host.runs[0]!.resolve('first listing')
  await flush()

  host.setAdapterConfig({ ...FIRST })
  await flush()
  expect(readFor(host, host.read)).toBe('first listing')
  expect(host.runs).toHaveLength(1)
})
