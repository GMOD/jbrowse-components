import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeMultiWiggleData } from './testEnv.ts'

import type { RpcStatus } from '@jbrowse/core/util'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('MultiLinearWiggleDisplay declarative runClustering', () => {
  it('runs the real clustering RPC once sources are loaded, then clears the flag', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'MultiWiggleClusterScoreMatrix') {
        return Promise.resolve({ order: [1, 0], tree: '(b,a);' })
      }
      return Promise.resolve(makeMultiWiggleData('a', 'b'))
    })

    const { display } = createDisplay({ runClustering: true })

    // fetch autorun loads sourcesWithoutLayout
    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sourcesWithoutLayout.length).toBe(2)
    })

    // cluster autorun (500ms mobx delay) then fires against the now-loaded sources
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.clusterTree).toBe('(b,a);')
    })
    expect(display.layout.map(s => s.name)).toEqual(['b', 'a'])

    // one-shot: the flag clears itself so a saved session never re-triggers it
    expect(display.runClustering).toBeUndefined()

    expect(
      mockRpcCall.mock.calls.filter(
        ([, method]) => method === 'MultiWiggleClusterScoreMatrix',
      ),
    ).toHaveLength(1)
  })

  // The declarative path has no dialog to report into, so the RPC's status
  // lands on the display, where DisplayChrome shows it as a corner chip.
  it('reports clustering progress on the display, then clears it', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    const duringRun: (string | undefined)[] = []
    mockRpcCall.mockImplementation(
      (
        _sid: string,
        method: string,
        args: { statusCallback?: (status: RpcStatus) => void },
      ) => {
        if (method === 'MultiWiggleClusterScoreMatrix') {
          args.statusCallback?.({
            message: 'Clustering rows',
            current: 1,
            total: 4,
          })
          duringRun.push(display.statusMessage, `${display.statusProgress}`)
          return Promise.resolve({ order: [1, 0], tree: '(b,a);' })
        }
        return Promise.resolve(makeMultiWiggleData('a', 'b'))
      },
    )

    const { display } = createDisplay({ runClustering: true })

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sourcesWithoutLayout.length).toBe(2)
    })
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.clusterTree).toBe('(b,a);')
    })
    expect(duringRun).toEqual(['Clustering rows', '0.25'])
    // a status left set outlives the run and would pin the chip up
    expect(display.statusMessage).toBeUndefined()
  })

  // The status channel is out-of-band from the call's return value, so a
  // progress message can be delivered after the RPC has already resolved. With
  // nothing running and the phase back to `ready`, such a write would set a
  // status no run will ever clear, pinning the chip up for good.
  it('ignores a status delivered after the run finished', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    let late: ((status: RpcStatus) => void) | undefined
    mockRpcCall.mockImplementation(
      (
        _sid: string,
        method: string,
        args: { statusCallback?: (status: RpcStatus) => void },
      ) => {
        if (method === 'MultiWiggleClusterScoreMatrix') {
          late = args.statusCallback
          return Promise.resolve({ order: [1, 0], tree: '(b,a);' })
        }
        return Promise.resolve(makeMultiWiggleData('a', 'b'))
      },
    )

    const { display } = createDisplay({ runClustering: true })

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sourcesWithoutLayout.length).toBe(2)
    })
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.clusterTree).toBe('(b,a);')
    })

    late?.({ message: 'Clustering rows', current: 3, total: 4 })
    expect(display.statusMessage).toBeUndefined()
  })

  it('does not call the clustering RPC when runClustering is unset', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeMultiWiggleData('a', 'b'))

    createDisplay({ runClustering: false })

    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    expect(
      mockRpcCall.mock.calls.some(
        ([, method]) => method === 'MultiWiggleClusterScoreMatrix',
      ),
    ).toBe(false)
  })
})
