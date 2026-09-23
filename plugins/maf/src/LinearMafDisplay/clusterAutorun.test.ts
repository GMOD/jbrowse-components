import { getConf } from '@jbrowse/core/configuration'
import { waitFor } from '@testing-library/react'

import { emptyMafWireRegionData } from './components/coverageTestFixture.ts'
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
  regionData: emptyMafWireRegionData(),
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
      expect(display.rowTree).toBe('(panTro4,hg38);')
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

  // The adapter re-supplies its guide tree on every fetch, so a stored copy
  // would go stale behind an edited `.nh`. A clustered tree is not supplied:
  // nothing recomputes it, and dropping it would restore the clustered row
  // order with no dendrogram beside it.
  it('keeps the guide tree out of rows.tree and lands a clustered one there', () => {
    const env = createMafTestEnvironment()
    const { display } = env.createDisplay()
    display.setSamples({
      samples: [sample('hg38'), sample('panTro4')],
      treeNewick: '(hg38,panTro4);',
      samplesCanonical: true,
    })
    expect(display.rowTree).toBe('(hg38,panTro4);')
    expect(getConf(display, ['rows', 'tree'])).toBeUndefined()

    display.setRowOrder([{ name: 'panTro4' }, { name: 'hg38' }], {
      tree: '(panTro4,hg38);',
      provenance: { regions: [{ refName: 'chr1', start: 0, end: 100 }] },
    })
    expect(getConf(display, ['rows', 'tree'])).toBe('(panTro4,hg38);')
    expect(display.rowTreeProvenance).toBeDefined()

    display.resetRowArrangement()
    expect(display.rowTree).toBe('(hg38,panTro4);')
    expect(display.rowTreeProvenance).toBeUndefined()
    expect(getConf(display, ['rows', 'tree'])).toBeUndefined()
  })
})
