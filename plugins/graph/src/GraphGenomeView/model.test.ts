import { applySnapshot, getSnapshot } from '@jbrowse/mobx-state-tree'

const mockRpcCall = jest.fn()
const mockSession = {
  tracks: [] as { trackId: string; [key: string]: unknown }[],
  rpcManager: { call: mockRpcCall },
}

// Don't use jest.requireActual due to circular dependencies
// Instead, manually mock just what we need
jest.mock('@jbrowse/core/util', () => {
  // Return minimal mock that doesn't trigger circular load
  return {
    getSession: () => mockSession,
    isSessionModelWithWidgets: () => false,
    // Add stubs for other potentially imported items
    parseLocString: () => ({}),
    getEnv: () => ({}),
    useWidthSetter: () => {},
    measureText: () => 0,
    IntervalTree: class {},
    // Add other exports that might be needed
    checkStopToken: () => false,
    getSnapshot: () => ({}),
    applySnapshot: () => {},
    objectHash: () => '',
  }
})

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: jest.fn((obj: Record<string, unknown>, key: string) =>
    key === 'adapter' ? obj.adapter : undefined,
  ),
}))

import stateModelFactory from './model.ts'

const SIMPLE_GFA = 'H\tVN:Z:1.0\nS\t1\tACGT\nS\t2\tGGCC\nL\t1\t+\t2\t+\t0M\n'

const MOCK_LAYOUT = {
  nodePositions: {
    '1+': [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ],
    '1-': [
      { x: 0, y: 5 },
      { x: 5, y: 5 },
    ],
    '2+': [
      { x: 10, y: 0 },
      { x: 15, y: 0 },
    ],
    '2-': [
      { x: 10, y: 5 },
      { x: 15, y: 5 },
    ],
  },
}

function rpcRespond() {
  mockRpcCall.mockImplementation((_sid: unknown, method: string) => {
    if (method === 'GetSubgraph') {
      return Promise.resolve(SIMPLE_GFA)
    }
    if (method === 'GraphComputeLayout') {
      return Promise.resolve({ result: MOCK_LAYOUT })
    }
    return Promise.reject(new Error(`Unexpected RPC: ${method}`))
  })
}

function createModel() {
  return stateModelFactory().create({ type: 'GraphGenomeView' })
}

const TEST_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 1000,
  end: 5000,
}

const TEST_TRACK = {
  trackId: 'gfa-track',
  adapter: { type: 'GfaTabixAdapter' },
}

describe('loadFromTabixSubgraph state storage', () => {
  beforeEach(() => {
    mockRpcCall.mockReset()
    mockSession.tracks = []
  })

  test('stores trackId and region when trackId is provided', async () => {
    rpcRespond()
    const model = createModel()
    await model.loadFromTabixSubgraph(
      { type: 'GfaTabixAdapter' },
      TEST_REGION,
      {
        trackId: 'gfa-track',
      },
    )
    expect(model.loadedTrackId).toBe('gfa-track')
    expect(model.loadedRegion).toEqual(TEST_REGION)
  })

  test('clears stored params when no trackId given', async () => {
    rpcRespond()
    const model = createModel()
    await model.loadFromTabixSubgraph(
      { type: 'GfaTabixAdapter' },
      TEST_REGION,
      {
        trackId: 'gfa-track',
      },
    )
    expect(model.loadedTrackId).toBe('gfa-track')

    rpcRespond()
    await model.loadFromTabixSubgraph(
      { type: 'GfaTabixAdapter' },
      TEST_REGION,
      {},
    )
    expect(model.loadedTrackId).toBe('')
    expect(model.loadedRegion).toBeUndefined()
  })
})

describe('loadGFA clears restore params', () => {
  beforeEach(() => {
    mockRpcCall.mockReset()
    mockSession.tracks = []
  })

  test('loadGFA clears trackId and region stored by a prior tabix load', async () => {
    rpcRespond()
    const model = createModel()
    await model.loadFromTabixSubgraph(
      { type: 'GfaTabixAdapter' },
      TEST_REGION,
      {
        trackId: 'gfa-track',
      },
    )
    expect(model.loadedTrackId).toBe('gfa-track')

    rpcRespond()
    await model.loadGFA(SIMPLE_GFA, 'imported')
    expect(model.loadedTrackId).toBe('')
    expect(model.loadedRegion).toBeUndefined()
  })
})

describe('refetchIfNeeded guard conditions', () => {
  beforeEach(() => {
    mockRpcCall.mockReset()
    mockSession.tracks = []
  })

  test('does nothing when no trackId is stored', async () => {
    const model = createModel()
    await model.refetchIfNeeded()
    expect(mockRpcCall).not.toHaveBeenCalled()
  })

  test('does nothing when no region is stored', async () => {
    const model = createModel()
    applySnapshot(model, { ...getSnapshot(model), loadedTrackId: 'gfa-track' })
    await model.refetchIfNeeded()
    expect(mockRpcCall).not.toHaveBeenCalled()
  })

  test('does nothing when graph is already loaded', async () => {
    rpcRespond()
    const model = createModel()
    mockSession.tracks = [TEST_TRACK]
    await model.loadFromTabixSubgraph(
      { type: 'GfaTabixAdapter' },
      TEST_REGION,
      {
        trackId: 'gfa-track',
      },
    )
    expect(model.graph).toBeDefined()

    mockRpcCall.mockReset()
    await model.refetchIfNeeded()
    expect(mockRpcCall).not.toHaveBeenCalled()
  })

  test('does nothing when stored trackId is not in session tracks', async () => {
    const model = createModel()
    applySnapshot(model, {
      ...getSnapshot(model),
      loadedTrackId: 'missing-track',
      loadedRegion: TEST_REGION,
    })
    mockSession.tracks = []
    await model.refetchIfNeeded()
    expect(mockRpcCall).not.toHaveBeenCalled()
  })
})

describe('refetchIfNeeded restore flow', () => {
  beforeEach(() => {
    mockRpcCall.mockReset()
    mockSession.tracks = []
  })

  test('fetches the graph when stored params are present', async () => {
    const model = createModel()
    applySnapshot(model, {
      ...getSnapshot(model),
      loadedTrackId: 'gfa-track',
      loadedRegion: TEST_REGION,
    })
    mockSession.tracks = [TEST_TRACK]
    rpcRespond()

    await model.refetchIfNeeded()

    expect(model.graph).toBeDefined()
    expect(model.graph!.nodes.length).toBeGreaterThan(0)
  })

  test('preserves pan/zoom state after restore', async () => {
    const model = createModel()
    applySnapshot(model, {
      ...getSnapshot(model),
      loadedTrackId: 'gfa-track',
      loadedRegion: TEST_REGION,
      scale: 3.5,
      translateX: 120,
      translateY: 80,
    })
    mockSession.tracks = [TEST_TRACK]
    rpcRespond()

    await model.refetchIfNeeded()

    expect(model.scale).toBe(3.5)
    expect(model.translateX).toBe(120)
    expect(model.translateY).toBe(80)
  })
})
