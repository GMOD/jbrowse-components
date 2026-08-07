import { createStopToken } from '@jbrowse/core/util/stopToken'

import { runGenotypeClustering } from '../shared/runGenotypeClustering.ts'
import { createTestEnvironment } from './testEnv.ts'

// The phased counterpart to clusterTreeLands.test.ts. There the rows the tree
// names are samples; here they are haplotypes, and the display only knows how
// many each sample has once `sampleInfo` has arrived on `cellData`.
const SOURCES = [{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }]

const SAMPLE_INFO = {
  S0: { maxPloidy: 2 },
  S1: { maxPloidy: 2 },
  S2: { maxPloidy: 2 },
}

// Six haplotype rows, reordered so S2's pair leads. hclust's `order` is the leaf
// order of the newick it returns, so leaf i lands on row i.
const HAPLOTYPE_ORDER = [4, 5, 0, 1, 2, 3]
const HAPLOTYPE_TREE = '(((S2 HP0,S2 HP1),(S0 HP0,S0 HP1)),(S1 HP0,S1 HP1));'

const regions = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
]

async function clusterPhased() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SOURCES)
  display.setPhasedMode('phased')
  // sampleInfo reaches the model only through cellData, which is what
  // `clusteringReady` waits for in phased mode
  display.setCellData({
    sampleInfo: SAMPLE_INFO,
    rowNames: ['S0 HP0', 'S0 HP1', 'S1 HP0', 'S1 HP1', 'S2 HP0', 'S2 HP1'],
  } as unknown as Parameters<typeof display.setCellData>[0])

  await runGenotypeClustering({
    model: display,
    rpcManager: {
      call: async () => ({ order: HAPLOTYPE_ORDER, tree: HAPLOTYPE_TREE }),
    },
    sessionId: 'session-1',
    regions,
    stopToken: createStopToken(),
    statusCallback: () => {},
  })
  return display
}

test('phased mode reports itself ready to cluster once sampleInfo lands', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SOURCES)
  display.setPhasedMode('phased')
  expect(display.clusteringReady).toBe(false)

  display.setCellData({
    sampleInfo: SAMPLE_INFO,
    rowNames: [],
  } as unknown as Parameters<typeof display.setCellData>[0])
  expect(display.clusteringReady).toBe(true)
})

test('a phased clustering run leaves a drawable dendrogram', async () => {
  const display = await clusterPhased()

  expect(display.clusterTree).toBe(HAPLOTYPE_TREE)
  expect(display.sources.map(s => s.name)).toEqual([
    'S2 HP0',
    'S2 HP1',
    'S0 HP0',
    'S0 HP1',
    'S1 HP0',
    'S1 HP1',
  ])
  // the check treeDescribesRows makes before it will position the dendrogram
  expect(display.hierarchy).toBeDefined()
})

test('a phased cluster does not change the sample set the fetch asks for', async () => {
  const display = await clusterPhased()

  // sampleFilter is deduped back to samples, so a haplotype-level layout must
  // not look like a new row set and trigger a refetch
  expect(display.sampleFilter).toEqual(['S0', 'S1', 'S2'])
})
