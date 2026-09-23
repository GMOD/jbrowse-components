import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { parseClusterTree, treeDescribesRows } from '@jbrowse/tree-sidebar'

import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './clusterModelTypes.ts'
import type { ClusterGenotypeMatrixCaller } from './runGenotypeClustering.ts'

// adapterConfig is forwarded to the RPC call opaquely (never read by
// runGenotypeClustering), so a minimal real config instance stands in for a
// real adapter's.
const adapterConfig = ConfigurationSchema('TestAdapter', {}).create({
  type: 'TestAdapter',
})

const regions = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
]

// What a run records about itself, so a dendrogram can say which locus and
// which site filters produced it. Asserted alongside the order and tree
// because it has to be written in the same action as the tree — provenance left
// over from a previous run would caption this one with the wrong region.
const withMode = (mode: string) => [
  { name: 'mode', value: mode },
  { name: 'MAF filter', value: '0' },
  { name: 'max missingness', value: '1' },
]

const PROVENANCE = {
  regions: [{ refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' }],
  settings: withMode('alleleCount'),
}

const THREE = [
  { name: 'sampleA', sampleName: 'sampleA' },
  { name: 'sampleB', sampleName: 'sampleB' },
  { name: 'sampleC', sampleName: 'sampleC' },
]

function makeModel(overrides: Partial<ReducedModel> = {}): ReducedModel {
  return {
    minorAlleleFrequencyFilter: 0,
    maxMissingnessFilter: 1,
    sourcesBase: THREE,
    clusterableSources: THREE,
    editableSources: THREE,
    adapterConfig,
    renderingMode: 'alleleCount',
    rowDomain: [],
    clusteringReady: true,
    hasClusterableRows: true,
    setRowOrder: jest.fn(),
    ...overrides,
  }
}

function makeRpcManager(
  call: ClusterGenotypeMatrixCaller['call'],
): ClusterGenotypeMatrixCaller {
  return { call: jest.fn(call) }
}

describe('runGenotypeClustering', () => {
  it('calls the registered RPC method with the model state, and applies the returned order/tree', async () => {
    const model = makeModel()
    const rpcManager = makeRpcManager(async () => ({
      order: [2, 0, 1],
      tree: '(a,b,c);',
    }))

    await runGenotypeClustering({
      model,
      rpcManager,
      sessionId: 'session-1',
      regions,
      signal: new AbortController().signal,
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).toHaveBeenCalledWith(
      'session-1',
      'MultiSampleVariantClusterGenotypeMatrix',
      expect.objectContaining({
        regions,
        sources: model.clusterableSources,
        minorAlleleFrequencyFilter: 0,
        maxMissingnessFilter: 1,
        renderingMode: 'alleleCount',
      }),
    )
    expect(model.setRowOrder).toHaveBeenCalledWith(
      [{ name: 'sampleC' }, { name: 'sampleA' }, { name: 'sampleB' }],
      { tree: '(a,b,c);', provenance: PROVENANCE },
    )
  })

  // A run on a domain-seeded track composes with the seed: the dendrogram turns
  // towards the declared order and the order follows its leaves, so the tree
  // still describes the rows. Placing each named sample outright instead would
  // read sampleB, sampleC, sampleA and leave the dendrogram describing nobody.
  it('rotates the run towards the config domain', async () => {
    const model = makeModel({ rowDomain: ['sampleB', 'sampleC'] })
    const rpcManager = makeRpcManager(async () => ({
      order: [0, 1, 2],
      tree: '((sampleA:1,sampleB:1):1,sampleC:2);',
    }))

    await runGenotypeClustering({
      model,
      rpcManager,
      sessionId: 'session-1',
      regions,
      signal: new AbortController().signal,
      statusCallback: jest.fn(),
    })

    const [order, run] = jest.mocked(model.setRowOrder).mock.calls[0]!
    const tree = run?.tree
    expect(order.map(s => s.name)).toEqual(['sampleB', 'sampleA', 'sampleC'])
    expect(treeDescribesRows(parseClusterTree(tree!), order)).toBe(true)
  })

  it('passes through the display filter values', async () => {
    const model = makeModel({
      minorAlleleFrequencyFilter: 0.05,
      maxMissingnessFilter: 0.2,
    })
    // a complete order — applyClusterOrder validates it covers every row
    const rpcManager = makeRpcManager(async () => ({
      order: [0, 1, 2],
      tree: '(a,b,c);',
    }))

    await runGenotypeClustering({
      model,
      rpcManager,
      sessionId: 'session-1',
      regions,
      signal: new AbortController().signal,
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).toHaveBeenCalledWith(
      'session-1',
      'MultiSampleVariantClusterGenotypeMatrix',
      expect.objectContaining({
        minorAlleleFrequencyFilter: 0.05,
        maxMissingnessFilter: 0.2,
      }),
    )
  })

  it('does nothing when the sources are not yet loaded', async () => {
    const model = makeModel({ sourcesBase: undefined })
    const rpcManager = makeRpcManager(jest.fn())

    await runGenotypeClustering({
      model,
      rpcManager,
      sessionId: 'session-1',
      regions,
      signal: new AbortController().signal,
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).not.toHaveBeenCalled()
    expect(model.setRowOrder).not.toHaveBeenCalled()
  })

  // Phased mode clusters the haplotype rows the display draws, so the order
  // indexes those and lands as their names.
  it('orders the haplotype rows in phased mode', async () => {
    const haplotypes = ['sampleA', 'sampleB'].flatMap(sampleName => [
      { name: `${sampleName} HP0`, sampleName, HP: 0 },
      { name: `${sampleName} HP1`, sampleName, HP: 1 },
    ])
    const model = makeModel({
      clusterableSources: haplotypes,
      editableSources: haplotypes,
      renderingMode: 'phased',
      sampleInfo: {
        sampleA: { isPhased: true, maxPloidy: 2 },
        sampleB: { isPhased: true, maxPloidy: 2 },
      },
    })
    const rpcManager = makeRpcManager(async () => ({
      order: [3, 2, 1, 0],
      tree: '(...);',
    }))

    await runGenotypeClustering({
      model,
      rpcManager,
      sessionId: 'session-1',
      regions,
      signal: new AbortController().signal,
      statusCallback: jest.fn(),
    })

    expect(model.setRowOrder).toHaveBeenCalledWith(
      [
        { name: 'sampleB HP1' },
        { name: 'sampleB HP0' },
        { name: 'sampleA HP1' },
        { name: 'sampleA HP0' },
      ],
      {
        tree: '(...);',
        provenance: // the recorded mode follows the run, since a phased tree clusters
          // haplotype rows rather than sample rows
          { ...PROVENANCE, settings: withMode('phased') },
      },
    )
  })

  it('clusters the visible rows and keeps the hidden ones in the order', async () => {
    // What a focus leaves: the clustered rows are the focused set, while the
    // order still records every row. The hidden row isn't clustered — it isn't
    // in the tree — but dropping it from the order would move it to the end
    // once the focus is cleared.
    const model = makeModel({
      clusterableSources: THREE.slice(0, 2),
    })
    const rpcManager = makeRpcManager(async () => ({
      order: [1, 0],
      tree: '(a,b);',
    }))

    await runGenotypeClustering({
      model,
      rpcManager,
      sessionId: 'session-1',
      regions,
      signal: new AbortController().signal,
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).toHaveBeenCalledWith(
      'session-1',
      'MultiSampleVariantClusterGenotypeMatrix',
      expect.objectContaining({ sources: model.clusterableSources }),
    )
    expect(model.setRowOrder).toHaveBeenCalledWith(
      [{ name: 'sampleB' }, { name: 'sampleA' }, { name: 'sampleC' }],
      { tree: '(a,b);', provenance: PROVENANCE },
    )
  })
})
