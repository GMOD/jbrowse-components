import { waitFor } from '@testing-library/react'

import { runWiggleClustering } from './runWiggleClustering.ts'
import { createTestEnvironment, makeMultiWiggleData } from './testEnv.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

async function loadedDisplay() {
  const { createDisplay, mockRpcCall } = createTestEnvironment()
  mockRpcCall.mockResolvedValue(makeMultiWiggleData('a', 'b'))
  const { display, view } = createDisplay()
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.sourcesWithoutLayout.length).toBe(2)
  })
  return { display, view }
}

function recordingRpc() {
  const calls: { bpPerPx?: number }[] = []
  return {
    calls,
    rpcManager: {
      call: (
        _sid: string,
        _name: 'MultiWiggleClusterScoreMatrix',
        args: {
          bpPerPx: number
        },
      ) => {
        calls.push(args)
        return Promise.resolve({ order: [1, 0], tree: '(b,a);' })
      },
    },
  }
}

async function clusterAt(samplesPerPixel: string) {
  const { display, view } = await loadedDisplay()
  const { calls, rpcManager } = recordingRpc()
  await runWiggleClustering({
    model: display,
    rpcManager,
    sessionId: 'sid',
    samplesPerPixel,
    regions: view.dynamicBlocks.contentBlocks,
    stopToken: 'token',
    statusCallback: () => {},
  })
  return { settings: display.clusterProvenance?.settings, calls, view }
}

// The caption has to name the density the matrix was actually binned at:
// `samplesPerPixel` is a free-text field and `parseSamplesPerPixel` clamps and
// defaults it before the RPC sees it.
test('captions a clamped density with the value the RPC binned at', async () => {
  const { settings } = await clusterAt('5000')
  expect(settings).toEqual([{ name: 'samples/px', value: '100' }])
})

test('captions unparseable text with the default density', async () => {
  const { settings } = await clusterAt('abc')
  expect(settings).toEqual([{ name: 'samples/px', value: '1' }])
})

// The columns are pixel bins over the run's own regions, so the resolution is
// that span across the view's width, divided by the sampling density — never
// the view's own bpPerPx, which describes whatever it happens to be showing.
test('bins the matrix over the span of the regions it was given', async () => {
  const { calls, view } = await clusterAt('2')
  const span = view.dynamicBlocks.contentBlocks.reduce(
    (a, r) => a + (r.end - r.start),
    0,
  )
  expect(calls[0]!.bpPerPx).toBeCloseTo(span / view.width / 2)
})
