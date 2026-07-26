import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeMultiWiggleData } from './testEnv.ts'

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

    // fetch autorun loads sourcesVolatile
    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sourcesVolatile.length).toBe(2)
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
