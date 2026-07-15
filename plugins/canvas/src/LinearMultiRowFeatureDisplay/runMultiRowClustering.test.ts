import { createStopToken } from '@jbrowse/core/util/stopToken'

import { runMultiRowClustering } from './runMultiRowClustering.ts'

import type { MultiRowClusterModel } from './runMultiRowClustering.ts'

const view = {
  dynamicBlocks: {
    contentBlocks: [
      { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    ],
  },
} as Parameters<typeof runMultiRowClustering>[0]['view']

function makeModel(names: string[]) {
  const setLayoutAndClusterTree = jest.fn()
  const model = {
    sourcesWithoutLayout: names.map(name => ({ name })),
    layout: [],
    adapterConfig: { type: 'BedTabixAdapter' },
    partitionField: 'sample',
    colorConfig: 'jexl:get(feature,"color")',
    setLayoutAndClusterTree,
  } satisfies MultiRowClusterModel
  return { model, setLayoutAndClusterTree }
}

test('calls the registry RPC and applies the clustered order + tree', async () => {
  const { model, setLayoutAndClusterTree } = makeModel(['a', 'b', 'c'])
  const call = jest
    .fn()
    .mockResolvedValue({ order: [2, 0, 1], tree: '((c,a),b);' })

  await runMultiRowClustering({
    model,
    view,
    rpcManager: { call },
    sessionId: 'sess1',
    stopToken: createStopToken(),
    statusCallback: () => {},
  })

  expect(call).toHaveBeenCalledTimes(1)
  const [sessionId, method, args] = call.mock.calls[0]!
  expect(sessionId).toBe('sess1')
  expect(method).toBe('MultiRowClusterFeatures')
  expect(args.sources).toEqual(['a', 'b', 'c'])
  expect(args.partitionField).toBe('sample')
  expect(args.regions).toHaveLength(1)

  // order [2,0,1] reorders [a,b,c] → [c,a,b]
  expect(setLayoutAndClusterTree).toHaveBeenCalledTimes(1)
  const [layout, tree] = setLayoutAndClusterTree.mock.calls[0]!
  expect(layout.map((s: { name: string }) => s.name)).toEqual(['c', 'a', 'b'])
  expect(tree).toBe('((c,a),b);')
})

test('skips the RPC when fewer than two rows', async () => {
  const { model, setLayoutAndClusterTree } = makeModel(['only'])
  const call = jest.fn()

  await runMultiRowClustering({
    model,
    view,
    rpcManager: { call },
    sessionId: 'sess1',
    stopToken: createStopToken(),
    statusCallback: () => {},
  })

  expect(call).not.toHaveBeenCalled()
  expect(setLayoutAndClusterTree).not.toHaveBeenCalled()
})
