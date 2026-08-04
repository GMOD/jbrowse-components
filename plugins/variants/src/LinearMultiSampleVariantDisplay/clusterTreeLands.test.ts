import { createStopToken } from '@jbrowse/core/util/stopToken'

import { runGenotypeClustering } from '../shared/runGenotypeClustering.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ReducedModel } from '../shared/clusterModelTypes.ts'

const SOURCES = [{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }]

// hclust's `order` is exactly the leaf order of the newick it returns, so leaf
// i lands on row i — which is what `treeDescribesRows` checks before it will
// position the dendrogram.
const RPC_RESULT = { order: [2, 0, 1], tree: '((S2,S0),S1);' }

const regions = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
]

// A clustering run over a real display model, driven through the same function
// the "Run clustering" button and the declarative `runClustering: true` autorun
// both call.
async function cluster() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SOURCES)
  await runGenotypeClustering({
    model: display as unknown as ReducedModel,
    rpcManager: { call: async () => RPC_RESULT },
    sessionId: 'session-1',
    regions,
    stopToken: createStopToken(),
    statusCallback: () => {},
  })
  return display
}

// The regression: the tree used to be stashed as `pendingClusterTree` and only
// promoted in `setCellData`, from back when `layout` was an RPC input and a
// clustering run therefore refetched. Row order is not a fetch input any more —
// the worker names its rows and `rowRemap` places them — so nothing refetches
// after a cluster, the promotion never fired, and a display whose session asked
// for `runClustering: true` rendered no dendrogram at all. That is silent: the
// rows are still clustered, so only the missing sidebar says anything.
test('a clustering run leaves a drawable dendrogram with no further fetch', async () => {
  const display = await cluster()

  expect(display.clusterTree).toBe(RPC_RESULT.tree)
  expect(display.sources?.map(s => s.name)).toEqual(['S2', 'S0', 'S1'])
  // positions, i.e. computeClusterHierarchy agrees the tree names these rows
  expect(display.hierarchy).toBeDefined()
})

// The other half of why it can be applied immediately: the cells on screen
// follow the new order in the same tick, because they are placed by name
// against `sources` rather than shipped in row order.
test('the rows the tree names are the rows the cells are placed onto', async () => {
  const display = await cluster()
  display.setCellData({
    rowNames: ['S0', 'S1', 'S2'],
  } as unknown as Parameters<typeof display.setCellData>[0])

  // worker row i -> screen row: S0 is drawn second, S1 third, S2 first
  expect([...(display.rowRemap ?? [])]).toEqual([1, 2, 0])
})
