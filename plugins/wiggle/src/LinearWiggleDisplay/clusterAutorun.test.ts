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

    // fetch autorun loads discoveredRows
    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.discoveredRows.length).toBe(2)
    })
    expect(display.awaitingDependentData).toBe(true)
    expect(display.svgReady).toBe(false)

    // cluster autorun (500ms mobx delay) then fires against the now-loaded sources
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.rowTree).toBe('(b,a);')
    })
    expect(display.rowSort).toEqual(['b', 'a'])

    // one-shot: the flag clears itself so a saved session never re-triggers it
    expect(display.runClustering).toBeUndefined()
    expect(display.awaitingDependentData).toBe(false)
    expect(display.svgReady).toBe(true)

    expect(
      mockRpcCall.mock.calls.filter(
        ([, method]) => method === 'MultiWiggleClusterScoreMatrix',
      ),
    ).toHaveLength(1)
  })

  it('on a log axis with no scores loaded runs without waiting on a domain', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      displayConfig: { scales: { y: { type: 'log' } } },
    })
    mockRpcCall.mockImplementation((_sid: string, method: string) =>
      Promise.resolve(
        method === 'MultiWiggleClusterScoreMatrix'
          ? { order: [1, 0], tree: '(b,a);' }
          : makeMultiWiggleData('a', 'b'),
      ),
    )
    const { display } = createDisplay({ runClustering: true })
    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.discoveredRows.length).toBe(2)
    })
    expect(display.domain).toBeUndefined()
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()
    await waitFor(() => {
      expect(display.rowTree).toBe('(b,a);')
    })
  })

  it('on a log axis waits for the domain while scores are loaded', () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { scales: { y: { type: 'log' } } },
    })
    const { display } = createDisplay()
    const scored = makeMultiWiggleData('a', 'b')[0]!
    scored.sources[0]!.numFeatures = 1
    display.setRpcData(0, scored, {
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'volvox',
    })
    expect(display.clusterableSources.length).toBe(2)
    expect(display.domain).toBeUndefined()
    expect(display.autoClusterReady).toBe(false)
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
      expect(display.discoveredRows.length).toBe(2)
    })
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.rowTree).toBe('(b,a);')
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
      expect(display.discoveredRows.length).toBe(2)
    })
    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.rowTree).toBe('(b,a);')
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
