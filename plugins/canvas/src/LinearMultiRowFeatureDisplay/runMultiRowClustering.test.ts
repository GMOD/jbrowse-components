import { createStopToken } from '@jbrowse/core/util/stopToken'

import {
  featureMatrixKey,
  runMultiRowClustering,
} from './runMultiRowClustering.ts'

import type { MultiRowClusterModel } from './runMultiRowClustering.ts'

const regions = [
  { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
]

function makeModel(names: string[]) {
  const setLayoutAndClusterTree = jest.fn()
  const model = {
    sourcesWithoutLayout: names.map(name => ({ name })),
    layout: [],
    adapterConfig: { type: 'BedTabixAdapter' },
    effectivePartitionField: 'sample',
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
    regions,
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

// The key `useFetch` serializes on every render of the open dialog. It used to
// be the MST display node, which stringifies to the whole display snapshot —
// `layout` included, so a cohort's worth of rows went through JSON per render
// and any unrelated slot write re-keyed the fetch and re-ran the worker.
describe('featureMatrixKey', () => {
  const model = {
    sourcesWithoutLayout: [{ name: 'LINE' }, { name: 'SINE' }],
    layout: [],
    adapterConfig: { type: 'BedTabixAdapter' },
    effectivePartitionField: 'repClass',
    colorConfig: undefined,
    setLayoutAndClusterTree: () => {},
  } satisfies MultiRowClusterModel

  it('carries the arguments that decide what comes back', () => {
    expect(featureMatrixKey(model)).toEqual([
      'featureMatrix',
      'LINE\tSINE',
      'repClass',
      undefined,
    ])
  })

  it('moves when a run argument moves, and not otherwise', () => {
    const base = featureMatrixKey(model)

    expect(featureMatrixKey({ ...model, colorConfig: 'jexl:x' })).not.toEqual(
      base,
    )
    // the layout is not a run argument: the matrix is keyed by row NAME and
    // reordering the rows does not change what the worker returns
    expect(featureMatrixKey({ ...model, layout: [{ name: 'SINE' }] })).toEqual(
      base,
    )
  })

  it('is null before any row has been discovered', () => {
    expect(featureMatrixKey({ ...model, sourcesWithoutLayout: [] })).toBeNull()
  })
})
