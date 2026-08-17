import { createStopToken } from '@jbrowse/core/util/stopToken'

import { clusteredMafLayout, runMafClustering } from './runMafClustering.ts'

import type {
  ClusterIdentityMatrixCaller,
  MafClusterSelf,
} from './runMafClustering.ts'
import type { MafSource } from './stateModel.ts'

const regions = [{ assemblyName: 'hg38', refName: 'chr6', start: 0, end: 100 }]

function src(name: string): MafSource {
  return { name }
}

// `adapterConfig` is forwarded to the RPC opaquely and never read here, and the
// duck type only needs `IStateTreeNode` for the dialog's getSession/
// getContainingView — neither of which this function calls. So a plain object
// stands in.
function makeModel(overrides: Partial<MafClusterSelf> = {}) {
  return {
    sources: [src('GRCh38'), src('HG00099.1'), src('HG00099.2')],
    editableSources: [
      src('GRCh38'),
      src('HG00099.1'),
      src('HG00099.2'),
      src('HG00146.1'),
    ],
    layout: [],
    adapterConfig: { type: 'BgzipTaffyAdapter' },
    setLayout: jest.fn(),
    setLayoutAndClusterTree: jest.fn(),
    ...overrides,
  } as unknown as MafClusterSelf & {
    setLayout: jest.Mock
    setLayoutAndClusterTree: jest.Mock
  }
}

function makeRpcManager(
  order: number[],
  tree: string,
): ClusterIdentityMatrixCaller & { call: jest.Mock } {
  return {
    call: jest.fn(() => Promise.resolve({ order, tree })),
  }
}

async function run(
  model: ReturnType<typeof makeModel>,
  rpcManager: ReturnType<typeof makeRpcManager>,
) {
  await runMafClustering({
    model,
    rpcManager,
    sessionId: 'test',
    regions,
    stopToken: createStopToken(),
    statusCallback: jest.fn(),
  })
}

describe('runMafClustering', () => {
  // The contract the worker depends on: `order` comes back as indices into the
  // list of names sent, so the same array has to be both sent and applied. Send
  // the display's own row set in a different order from the one that comes back
  // and this is the only place that can get it wrong.
  it('sends the drawn rows by name and applies the order to them', async () => {
    const model = makeModel()
    const rpcManager = makeRpcManager([2, 0, 1], '((HG00099.2,GRCh38),x);')
    await run(model, rpcManager)

    expect(rpcManager.call.mock.calls[0]![2]).toMatchObject({
      sources: ['GRCh38', 'HG00099.1', 'HG00099.2'],
      adapterConfig: { type: 'BgzipTaffyAdapter' },
    })
    const [layout, tree] = model.setLayoutAndClusterTree.mock.calls[0]!
    expect(layout.slice(0, 3).map((s: MafSource) => s.name)).toEqual([
      'HG00099.2',
      'GRCh38',
      'HG00099.1',
    ])
    expect(tree).toBe('((HG00099.2,GRCh38),x);')
  })

  // `layout` is the persisted record of every row's position and colour, so a
  // row a subtree filter is hiding has to survive the write. Dropping it here
  // erases it for good the moment the filter is cleared.
  it('re-appends the rows a subtree filter is hiding', async () => {
    const model = makeModel()
    await run(model, makeRpcManager([0, 1, 2], '(a,b,c);'))
    const [layout] = model.setLayoutAndClusterTree.mock.calls[0]!
    expect(layout.map((s: MafSource) => s.name)).toEqual([
      'GRCh38',
      'HG00099.1',
      'HG00099.2',
      'HG00146.1',
    ])
  })

  // Written in the same action as the tree. Provenance left over from a
  // previous run would caption this one with the wrong locus, and clustering
  // reads only the region in view.
  it('records the locus it clustered over', async () => {
    const model = makeModel()
    await run(model, makeRpcManager([0, 1, 2], '(a,b,c);'))
    const [, , provenance] = model.setLayoutAndClusterTree.mock.calls[0]!
    expect(provenance).toEqual({
      regions: [{ refName: 'chr6', start: 0, end: 100, assemblyName: 'hg38' }],
    })
  })

  // The `ready` gate upstream is `sources.length > 1`, but nothing stops a
  // caller reaching this with an empty set, and an RPC over no rows is a
  // pointless round trip whose result cannot be applied.
  it('makes no call when there are no rows', async () => {
    const model = makeModel({ sources: [] })
    const rpcManager = makeRpcManager([], '')
    await run(model, rpcManager)
    expect(rpcManager.call).not.toHaveBeenCalled()
    expect(model.setLayoutAndClusterTree).not.toHaveBeenCalled()
  })

  // A hand-pasted order from the dialog's R tab is the one that can be short or
  // duplicated. Rejected rather than silently dropping or doubling rows.
  it('rejects an order that does not cover the drawn rows', () => {
    expect(() =>
      clusteredMafLayout({
        sources: [src('a'), src('b'), src('c')],
        editableSources: undefined,
        layout: [],
        order: [0, 1],
      }),
    ).toThrow()
  })
})
