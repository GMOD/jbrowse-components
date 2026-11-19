import { createTestEnvironment } from './testEnv.ts'

import type {
  HicDataResult,
  RenderHicDataArgs,
} from '../RenderHicDataRPC/types.ts'

// A chromosome jump replaces the displayed regions. The held matrix is placed
// from its `originBp`, a position along the displayed regions, so held past
// the jump it would draw chr1's contacts on chr2's axis. The display drops it
// at the jump and reads loading until chr2's matrix lands.

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 5000 }
const ctgB = { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 5000 }

function makeHicResult(args: RenderHicDataArgs): HicDataResult {
  return {
    instances: new Float32Array(0),
    numContacts: 0,
    minScore: 0,
    maxScore: 0,
    quantileScore: 0,
    quantile: args.quantile,
    binWidth: args.binSize / Math.SQRT2,
    originBp: args.originBp,
    binSize: args.binSize,
    appliedNormalizations: [args.normalization],
    appliedField: 'observed',
    regions: [],
    pairRuns: [],
  }
}

function contactRefNames(mockRpcCall: jest.Mock) {
  return mockRpcCall.mock.calls
    .filter(c => c[1] === 'RenderHicData')
    .map(c => (c[2] as RenderHicDataArgs).regions[0]?.refName)
}

// Every contact fetch is held until the test releases it, in issue order.
function heldContacts(mockRpcCall: jest.Mock) {
  const pending: (() => void)[] = []
  mockRpcCall.mockImplementation((_sid: string, method: string, args: never) =>
    method === 'CoreGetInfo'
      ? Promise.resolve({ norms: ['KR'], resolutions: [500, 1000, 5000] })
      : new Promise(resolve => {
          pending.push(() => {
            resolve(makeHicResult(args))
          })
        }),
  )
  return pending
}

async function flush() {
  await jest.advanceTimersByTimeAsync(1100)
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function setup() {
  const env = createTestEnvironment({
    assemblyRegions: [
      { ...ctgA, end: 10_000 },
      { ...ctgB, end: 10_000 },
    ],
  })
  const pending = heldContacts(env.mockRpcCall)
  const { display, view } = env.createDisplay({ displayedRegions: [ctgA] })
  return { display, view, pending, mockRpcCall: env.mockRpcCall }
}

test('a chromosome jump drops the held matrix and reads loading until the new one lands', async () => {
  const { display, view, pending, mockRpcCall } = setup()
  await flush()
  pending.shift()!()
  await flush()
  expect(display.dataCurrent).toBe(true)
  // the first paint, which the headless harness has no backend to make
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')
  expect(display.matrixRegions.size).toBe(1)

  view.setDisplayedRegions([ctgB])
  expect(display.matrixRegions.size).toBe(0)
  expect(display.displayPhase).toBe('loading')

  await flush()
  expect(contactRefNames(mockRpcCall).at(-1)).toBe('ctgB')
  expect(display.matrixRegions.size).toBe(0)
  expect(display.displayPhase).toBe('loading')

  pending.shift()!()
  await flush()
  expect(display.dataCurrent).toBe(true)
  expect(display.rpcData?.regions).toEqual([])
  expect(display.matrixRegions.size).toBe(1)
})

test('a chr1 fetch in flight at the jump commits nothing when it lands', async () => {
  const { display, view, pending } = setup()
  await flush()
  expect(pending).toHaveLength(1)

  view.setDisplayedRegions([ctgB])
  pending.shift()!()
  await jest.advanceTimersByTimeAsync(0)
  expect(display.rpcData).toBeNull()
  expect(display.loadedFetchKey).toBeUndefined()
  expect(display.displayPhase).toBe('loading')
})

// the dropped matrix takes its key with it, or a region list equal to the old
// one would find the held key current and never refetch into the empty display
test('the same regions set again refetch the dropped matrix', async () => {
  const { display, view, pending, mockRpcCall } = setup()
  await flush()
  pending.shift()!()
  await flush()
  const calls = contactRefNames(mockRpcCall).length

  view.setDisplayedRegions([{ ...ctgA }])
  expect(display.rpcData).toBeNull()
  await flush()
  expect(contactRefNames(mockRpcCall)).toHaveLength(calls + 1)
  pending.shift()!()
  await flush()
  expect(display.dataCurrent).toBe(true)
  expect(display.matrixRegions.size).toBe(1)
})

test('a pan within the displayed regions keeps the last frame up', async () => {
  const { display, view, pending } = setup()
  await flush()
  pending.shift()!()
  await flush()
  display.markCanvasDrawn()
  const held = display.rpcData

  view.horizontalScroll(20)
  await flush()
  expect(display.rpcData).toBe(held)
  expect(display.displayPhase).toBe('ready')
})
