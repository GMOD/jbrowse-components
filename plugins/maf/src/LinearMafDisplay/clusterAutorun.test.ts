import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import type { LinearMafDisplayModel } from './stateModel.ts'

// postProcessSnapshot returns the stripped shape on one branch and the whole
// snapshot on the other, and MST's signature collapses that to the stripped one
// — so the declared type says `clusterTree` is never persisted, which is the
// thing these assertions are about. Read through a record rather than asserting
// against a type that cannot express the case.
const snapshotOf = (display: LinearMafDisplayModel) =>
  getSnapshot(display) as unknown as Record<string, unknown>

import { createMafTestEnvironment } from './testEnv.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function sample(id: string) {
  return { id, label: id }
}

const EMPTY_ALIGNMENT_DATA = {
  samples: [],
  treeNewick: undefined,
  samplesCanonical: false,
  regionData: undefined,
}

// The declarative half of "Cluster rows by identity": a session or a figure spec
// sets `runClustering: true` and the run happens once the rows have arrived.
// Written for maf because this display had no clustering at all until now — its
// tree was always the adapter's guide phylogeny — so nothing else here would
// notice the run silently never firing.
describe('LinearMafDisplay declarative runClustering', () => {
  it('runs the clustering RPC once rows are loaded, then clears the flag', async () => {
    const env = createMafTestEnvironment()
    const { display } = env.createDisplay({
      displaySnapshot: { runClustering: true },
    })
    env.mockRpcCall.mockImplementation((_sid: string, method: string) => {
      if (method === 'LinearMafClusterIdentityMatrix') {
        return Promise.resolve({ order: [1, 0], tree: '(panTro4,hg38);' })
      }
      // the fetch path's own shape, so the region autoruns settle quietly
      // instead of logging a failure beside the assertions this file is about
      return Promise.resolve(EMPTY_ALIGNMENT_DATA)
    })

    // rows arrive the way a fetch delivers them, which is what the autorun's
    // `ready` gate is waiting on
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: undefined,
      samplesCanonical: true,
    })

    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    await waitFor(() => {
      expect(display.clusterTree).toBe('(panTro4,hg38);')
    })
    expect(display.sources.map(s => s.name)).toEqual(['panTro4', 'hg38'])

    // one-shot: the flag clears itself so a saved session never re-triggers it
    expect(display.runClustering).toBeUndefined()
    expect(
      env.mockRpcCall.mock.calls.filter(
        ([, method]) => method === 'LinearMafClusterIdentityMatrix',
      ),
    ).toHaveLength(1)
  })

  // One row has nothing to merge with, and hclust on it is an error rather than
  // a trivial tree. The gate is the same one the menu item is disabled by.
  it('does not run against a single row', async () => {
    const env = createMafTestEnvironment()
    const { display } = env.createDisplay({
      displaySnapshot: { runClustering: true },
    })
    display.setSamples({
      samples: [sample('hg38')],
      treeNewick: undefined,
      samplesCanonical: true,
    })

    jest.advanceTimersByTime(700)
    await jest.runAllTimersAsync()

    expect(
      env.mockRpcCall.mock.calls.filter(
        ([, method]) => method === 'LinearMafClusterIdentityMatrix',
      ),
    ).toHaveLength(0)
  })

  // A guide tree is re-supplied by the adapter on every fetch, so persisting it
  // would store a copy of something derived. A CLUSTERED tree is not: nothing
  // recomputes it, and dropping it would restore the clustered row order with no
  // dendrogram beside it. `clusterProvenance` is what tells the two apart.
  it('drops the guide tree from a snapshot and keeps a clustered one', () => {
    const env = createMafTestEnvironment()
    const { display } = env.createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: '(hg38,panTro4);',
      samplesCanonical: true,
    })
    expect(snapshotOf(display).clusterTree).toBeUndefined()

    display.setLayoutAndClusterTree(
      [{ name: 'panTro4' }, { name: 'hg38' }],
      '(panTro4,hg38);',
      { regions: [{ refName: 'chr1', start: 0, end: 100 }] },
    )
    expect(snapshotOf(display).clusterTree).toBe('(panTro4,hg38);')

    // Reset row order puts the guide tree back, and with it the snapshot rule:
    // `clearLayout` writes the tree with no provenance, so what comes back is a
    // supplied tree again and the snapshot stops carrying it. Pinned because
    // the postProcessSnapshot branch reads `clusterProvenance` and would
    // otherwise persist a guide tree the adapter re-supplies on every fetch.
    display.clearLayout()
    expect(display.clusterTree).toBe('(hg38,panTro4);')
    expect(display.clusterProvenance).toBeUndefined()
    expect(snapshotOf(display).clusterTree).toBeUndefined()
  })

  it('persists a computed tree and not a supplied one', () => {
    const env = createMafTestEnvironment()
    const { display } = env.createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: '(hg38,panTro4);',
      samplesCanonical: true,
    })
    expect(display.clusterTree).toBe('(hg38,panTro4);')
    expect(display.clusterProvenance).toBeUndefined()

    display.setLayoutAndClusterTree(
      [{ name: 'panTro4' }, { name: 'hg38' }],
      '(panTro4,hg38);',
      { regions: [{ refName: 'chr1', start: 0, end: 100 }] },
    )
    expect(display.clusterTree).toBe('(panTro4,hg38);')
    expect(display.clusterProvenance).toBeDefined()
  })
})
