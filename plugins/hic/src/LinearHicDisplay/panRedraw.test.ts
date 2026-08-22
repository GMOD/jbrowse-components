import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

import type {
  HicDataResult,
  RenderHicDataArgs,
} from '../RenderHicDataRPC/types.ts'

// Worker output is genomic, so a pan inside the loaded static blocks is a pure
// redraw: the per-frame view transform moves, the fetch signature does not, and
// no RPC goes out. Only a signature move — a zoom (static blocks re-snap), a
// block entering, a normalization flip — refetches. These pin both halves, and
// the arc-shaped reload contract that `prepare` gating on `dataCurrent` owes.

function makeHicResult(args: RenderHicDataArgs): HicDataResult {
  return {
    instances: new Float32Array(0),
    numContacts: 0,
    maxScore: 0,
    percentile95: 0,
    binWidth: args.resolution / Math.SQRT2,
    originBp: args.originBp,
    resolution: args.resolution,
    appliedNormalization: args.normalization,
    regions: [],
    pairRuns: [],
  }
}

function setupRpc(mockRpcCall: jest.Mock) {
  mockRpcCall.mockImplementation((_sid: string, method: string, args: never) =>
    method === 'CoreGetInfo'
      ? Promise.resolve({ norms: ['KR'], resolutions: [5000, 25000, 100000] })
      : Promise.resolve(makeHicResult(args)),
  )
}

function contactCalls(mockRpcCall: jest.Mock) {
  return mockRpcCall.mock.calls.filter(c => c[1] === 'RenderHicData')
}

async function loadedDisplay() {
  const env = createTestEnvironment()
  setupRpc(env.mockRpcCall)
  const { display, view } = env.createDisplay()
  jest.advanceTimersByTime(1100)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.rpcData).not.toBeNull()
    expect(display.dataCurrent).toBe(true)
  })
  return { display, view, mockRpcCall: env.mockRpcCall }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

test('a pan inside the loaded blocks redraws without a refetch', async () => {
  const { display, view, mockRpcCall } = await loadedDisplay()
  view.zoomTo(5000)
  jest.advanceTimersByTime(1100)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })

  const calls = contactCalls(mockRpcCall).length
  const offsetBefore = display.viewTransform.viewOffsetX
  const signatureBefore = display.fetchSignature

  view.horizontalScroll(10)
  expect(display.fetchSignature).toBe(signatureBefore)
  // the redraw half: the per-frame transform followed the viewport
  expect(display.viewTransform.viewOffsetX).toBe(offsetBefore - 10)
  expect(display.dataCurrent).toBe(true)

  jest.advanceTimersByTime(1100)
  await jest.runAllTimersAsync()
  expect(contactCalls(mockRpcCall).length).toBe(calls)
})

test('a zoom moves the signature and refetches', async () => {
  const { display, view, mockRpcCall } = await loadedDisplay()
  const calls = contactCalls(mockRpcCall).length
  const signatureBefore = display.fetchSignature

  view.zoomTo(5000)
  expect(display.fetchSignature).not.toBe(signatureBefore)
  expect(display.dataCurrent).toBe(false)

  jest.advanceTimersByTime(1100)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })
  expect(contactCalls(mockRpcCall).length).toBeGreaterThan(calls)
})

test('reload clears the loaded signature so the gated prepare rewakes', async () => {
  const { display, mockRpcCall } = await loadedDisplay()
  const calls = contactCalls(mockRpcCall).length
  const dataBefore = display.rpcData

  display.reload()
  // the stale matrix stays on screen under the overlay rather than blanking
  expect(display.rpcData).toBe(dataBefore)
  expect(display.dataCurrent).toBe(false)

  jest.advanceTimersByTime(1100)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })
  expect(contactCalls(mockRpcCall).length).toBeGreaterThan(calls)
  expect(display.rpcData).not.toBe(dataBefore)
})

test('stale data keeps drawing at its own origin during a refetch', async () => {
  const { display, view } = await loadedDisplay()
  view.zoomTo(5000)
  jest.advanceTimersByTime(1100)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })
  const loadedOrigin = display.rpcData!.originBp

  // hold the next fetch open so the stale window is observable
  view.zoomTo(12500)
  expect(display.dataCurrent).toBe(false)
  // the transform folds the PAYLOAD's origin against the LIVE viewport, so the
  // stale matrix lands at its genomic position rather than being rescaled
  const { viewScale, viewOffsetX } = display.viewTransform
  expect(viewScale).toBe(1 / view.bpPerPx)
  expect(viewOffsetX).toBe(loadedOrigin / view.bpPerPx - view.offsetPx)
})
