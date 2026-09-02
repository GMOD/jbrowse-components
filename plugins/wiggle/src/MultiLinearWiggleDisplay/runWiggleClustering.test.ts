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

const rpcManager = {
  call: () => Promise.resolve({ order: [1, 0], tree: '(b,a);' }),
}

async function clusterAt(samplesPerPixel: string) {
  const { display, view } = await loadedDisplay()
  await runWiggleClustering({
    model: display,
    rpcManager,
    sessionId: 'sid',
    samplesPerPixel,
    regions: view.dynamicBlocks.contentBlocks,
    stopToken: 'token',
    statusCallback: () => {},
  })
  return display.clusterProvenance?.settings
}

// The caption has to name the density the matrix was actually binned at:
// `samplesPerPixel` is a free-text field and `parseSamplesPerPixel` clamps and
// defaults it before the RPC sees it.
test('captions a clamped density with the value the RPC binned at', async () => {
  expect(await clusterAt('5000')).toEqual([
    { name: 'samples/px', value: '100' },
  ])
})

test('captions unparseable text with the default density', async () => {
  expect(await clusterAt('abc')).toEqual([{ name: 'samples/px', value: '1' }])
})
