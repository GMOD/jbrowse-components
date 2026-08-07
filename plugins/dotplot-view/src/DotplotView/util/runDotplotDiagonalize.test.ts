import { getSession } from '@jbrowse/core/util'

import { runDotplotDiagonalize } from './runDotplotDiagonalize.ts'

import type { DotplotViewModel } from '../model.ts'
import type { Region } from '@jbrowse/core/util'

// jest hoists these mocks above the imports. prepareDiagonalizeAdapter only does
// refName reconciliation, irrelevant here, so stub it to a passthrough spec that
// keeps the adapterConfig identifiable. Mirrors the synteny twin's test.
jest.mock('@jbrowse/synteny-core', () => ({
  prepareDiagonalizeAdapter: async ({
    adapterConfig,
    referenceRegions,
  }: {
    adapterConfig: Record<string, unknown>
    referenceRegions: Region[]
  }) => ({
    adapterConfig,
    fetchRegions: referenceRegions,
    refRefNameMap: {},
    queryRefNameMap: {},
  }),
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'test-session',
}))
jest.mock('@jbrowse/core/util', () => ({
  getSession: jest.fn(),
}))

function region(refName: string, assemblyName: string): Region {
  return { refName, start: 0, end: 100, assemblyName }
}

function axis(regions: Region[]) {
  return {
    displayedRegions: regions,
    setDisplayedRegions(r: Region[]) {
      this.displayedRegions = r
    },
  }
}

// The horizontal axis supplies the ordering, the vertical one gets reordered.
function makeModel(dotplotDisplays: { adapterConfig: object }[]) {
  return {
    hview: axis([region('h1', 'hg38'), region('h2', 'hg38')]),
    vview: axis([region('v1', 'mm10'), region('v2', 'mm10')]),
    dotplotDisplays,
  } as unknown as DotplotViewModel
}

// Record what the RPC was handed, then reverse currentRegions so the applied
// order is observably different from the input.
function setupRpc() {
  const call = jest.fn(
    async (
      _sessionId: string,
      _method: string,
      args: { currentRegions: Region[] },
    ) => ({
      newRegions: [...args.currentRegions].reverse(),
      stats: { regionsReordered: 2, regionsReversed: 1 },
    }),
  )
  ;(getSession as jest.Mock).mockReturnValue({
    assemblyManager: {},
    rpcManager: { call },
  })
  return call
}

// A dotplot can show several synteny tracks over its one assembly pair, and the
// reorder has to be computed from all of their alignments — the RPC takes an
// adapter list for exactly that. Reaching `tracks[0].displays[0]` instead sent
// one adapter and silently ordered the axis from a single file.
test('every display contributes an adapter', async () => {
  const call = setupRpc()
  const model = makeModel([
    { adapterConfig: { uri: 'a.paf' } },
    { adapterConfig: { uri: 'b.paf' } },
  ])

  const stats = await runDotplotDiagonalize(model)

  expect(call).toHaveBeenCalledTimes(1)
  const args = call.mock.calls[0]![2] as unknown as {
    adapters: { adapterConfig: { uri: string } }[]
    referenceRegions: Region[]
    currentRegions: Region[]
  }
  expect(args.adapters.map(a => a.adapterConfig.uri)).toEqual([
    'a.paf',
    'b.paf',
  ])
  // h supplies the ordering, v is the one being reordered — and v's assembly is
  // what the worker derives a multi-genome adapter's pair selector from
  expect(args.referenceRegions.map(r => r.refName)).toEqual(['h1', 'h2'])
  expect(args.currentRegions[0]?.assemblyName).toBe('mm10')

  // only the vertical axis moves
  expect(model.vview.displayedRegions.map(r => r.refName)).toEqual(['v2', 'v1'])
  expect(model.hview.displayedRegions.map(r => r.refName)).toEqual(['h1', 'h2'])
  expect(stats).toEqual({ totalReordered: 2, totalReversed: 1 })
})

// A plot with no dotplot display has nothing to diagonalize against. It has to
// resolve rather than throw: the init-time autoDiagonalize path awaits this
// before releasing the `settled` gate a screenshot capture waits on.
test('a plot with no displays resolves undefined without calling the RPC', async () => {
  const call = setupRpc()
  expect(await runDotplotDiagonalize(makeModel([]))).toBeUndefined()
  expect(call).not.toHaveBeenCalled()
})
