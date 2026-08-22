import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

// The declarative `runClustering: true` path, which a session spec and a figure
// recipe both reach without going near the track menu. The menu row is disabled
// below two samples; this is the entry point that isn't gated by being a menu
// row, so the count has to be stated on the autorun — the arrangement the
// multi-row feature display and multi-wiggle already have.
//
// Fake timers because the shared clustering autorun runs on a mobx delay.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

async function runWith(names: string[]) {
  const { createDisplay } = createTestEnvironment()
  const { display, mockRpcCall } = createDisplay({
    displaySnapshot: { runClustering: true },
  })
  // The sources RPC has to agree with the hand-seeded sources: the
  // prerequisite fetch runs on the leading edge, so a catch-all `[]` here
  // lands over the seed before the clustering commit and fails its row-count
  // validation. `warnings` is not optional in the payload — the commit walks
  // it — so a mock that omits it is a broken stub, not a quiet one.
  mockRpcCall.mockImplementation((_sid: string, method: string) =>
    method === 'MultiSampleVariantClusterGenotypeMatrix'
      ? Promise.resolve({ order: [1, 0], tree: '(b,a);' })
      : method === 'MultiSampleVariantGetSources'
        ? Promise.resolve({
            sources: names.map(name => ({ name })),
            warnings: [],
          })
        : Promise.resolve([]),
  )
  display.setSources(names.map(name => ({ name })))

  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()

  return {
    display,
    clusterCalls: mockRpcCall.mock.calls.filter(
      ([, method]) => method === 'MultiSampleVariantClusterGenotypeMatrix',
    ),
  }
}

test('clusters when the session asks and there are two samples', async () => {
  const { display, clusterCalls } = await runWith(['HG001', 'HG002'])

  expect(clusterCalls).toHaveLength(1)
  await waitFor(() => {
    expect(display.clusterTree).toBe('(b,a);')
  })
})

// A one-leaf dendrogram is not a clustering, and the matrix pass that produces
// it reads every genotype in the region to do it.
test('a single sample runs no clustering RPC at all', async () => {
  const { display, clusterCalls } = await runWith(['HG001'])

  expect(clusterCalls).toHaveLength(0)
  expect(display.clusterTree).toBeUndefined()
})
