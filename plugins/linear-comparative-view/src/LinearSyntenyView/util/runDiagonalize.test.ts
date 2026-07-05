import { getSession } from '@jbrowse/core/util'

import { runDiagonalize } from './runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { Region } from '@jbrowse/core/util'

// jest hoists these mocks above the imports. renameRegionsForAdapter /
// getAdapterToCanonicalRefNameMap only do refName reconciliation, irrelevant to
// the sweep order, so stub them to passthrough.
jest.mock('@jbrowse/synteny-core', () => ({
  renameRegionsForAdapter: async ({ regions }: { regions: Region[] }) =>
    regions,
  getAdapterToCanonicalRefNameMap: async () => ({}),
}))
jest.mock('@jbrowse/core/util/tracks', () => ({
  getRpcSessionId: () => 'test-session',
}))
jest.mock('@jbrowse/core/util', () => ({
  getSession: jest.fn(),
}))

function region(refName: string): Region {
  return { refName, start: 0, end: 100, assemblyName: 'asm' }
}

function makeView(regions: Region[]) {
  return {
    bpPerPx: 1,
    displayedRegions: regions,
    setDisplayedRegions(r: Region[]) {
      this.displayedRegions = r
    },
  }
}

// A level with one display; getRpcSessionId is stubbed so adapterConfig is a
// placeholder.
function makeLevel() {
  return { linearSyntenyDisplays: [{ adapterConfig: {} }] }
}

// The DiagonalizeSynteny RPC returns a reordering; we record the
// referenceRegions each level was called with, then reverse currentRegions so
// the applied order is observably different from the input.
function setupRpc() {
  const seenReferenceRegions: Region[][] = []
  const call = jest.fn(
    async (
      _sessionId: string,
      _method: string,
      args: { referenceRegions: Region[]; currentRegions: Region[] },
    ) => {
      seenReferenceRegions.push(args.referenceRegions)
      return {
        newRegions: [...args.currentRegions].reverse(),
        stats: {
          totalAlignments: 0,
          regionsProcessed: args.currentRegions.length,
          regionsReordered: args.currentRegions.length,
          regionsReversed: 0,
        },
      }
    },
  )
  ;(getSession as jest.Mock).mockReturnValue({
    assemblyManager: {},
    rpcManager: { call },
  })
  return { seenReferenceRegions, call }
}

describe('runDiagonalize cascade', () => {
  test('level i+1 diagonalizes against the row level i just reordered', async () => {
    const { seenReferenceRegions, call } = setupRpc()
    const peach = makeView([region('p1'), region('p2')])
    const cacao = makeView([region('c1'), region('c2')])
    const grape = makeView([region('g1'), region('g2')])
    const model = {
      views: [peach, cacao, grape],
      levels: [makeLevel(), makeLevel()],
    }

    await runDiagonalize(model as unknown as LinearSyntenyViewModel)

    // both levels ran
    expect(call).toHaveBeenCalledTimes(2)

    // level 0 saw peach's original order as its reference
    expect(seenReferenceRegions[0]!.map(r => r.refName)).toEqual(['p1', 'p2'])
    // level 0 reordered cacao (reversed)
    expect(cacao.displayedRegions.map(r => r.refName)).toEqual(['c2', 'c1'])

    // the cascade: level 1's reference is the *reordered* cacao, not its
    // original order — this is what the concurrent Promise.all version got
    // wrong (it would see ['c1','c2'])
    expect(seenReferenceRegions[1]!.map(r => r.refName)).toEqual(['c2', 'c1'])
    // level 1 reordered grape
    expect(grape.displayedRegions.map(r => r.refName)).toEqual(['g2', 'g1'])
  })

  test('returns undefined for a single-view stack', async () => {
    setupRpc()
    const model = {
      views: [makeView([region('a1')])],
      levels: [],
    }
    expect(
      await runDiagonalize(model as unknown as LinearSyntenyViewModel),
    ).toBeUndefined()
  })
})
