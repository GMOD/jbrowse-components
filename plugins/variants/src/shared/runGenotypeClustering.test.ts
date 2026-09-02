import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createStopToken } from '@jbrowse/core/util/stopToken'

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
// which site filters produced it. Asserted alongside the layout and tree
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

function makeModel(overrides: Partial<ReducedModel> = {}): ReducedModel {
  return {
    layout: [],
    minorAlleleFrequencyFilter: 0,
    maxMissingnessFilter: 1,
    sourcesBase: [
      { name: 'sampleA', sampleName: 'sampleA' },
      { name: 'sampleB', sampleName: 'sampleB' },
      { name: 'sampleC', sampleName: 'sampleC' },
    ],
    adapterConfig,
    renderingMode: 'alleleCount',
    clusteringReady: true,
    hasClusterableRows: true,
    setClusterTree: jest.fn(),
    setLayout: jest.fn(),
    setLayoutAndClusterTree: jest.fn(),
    clearLayout: jest.fn(),
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
      stopToken: createStopToken(),
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).toHaveBeenCalledWith(
      'session-1',
      'MultiSampleVariantClusterGenotypeMatrix',
      expect.objectContaining({
        regions,
        sources: model.sourcesBase,
        minorAlleleFrequencyFilter: 0,
        maxMissingnessFilter: 1,
        renderingMode: 'alleleCount',
      }),
    )
    expect(model.setLayoutAndClusterTree).toHaveBeenCalledWith(
      [
        { name: 'sampleC', sampleName: 'sampleC' },
        { name: 'sampleA', sampleName: 'sampleA' },
        { name: 'sampleB', sampleName: 'sampleB' },
      ],
      '(a,b,c);',
      PROVENANCE,
    )
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
      stopToken: createStopToken(),
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
      stopToken: createStopToken(),
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).not.toHaveBeenCalled()
    expect(model.setLayoutAndClusterTree).not.toHaveBeenCalled()
  })

  it('expands sources into per-haplotype rows before laying out, in phased mode', async () => {
    const model = makeModel({
      sourcesBase: [
        { name: 'sampleA', sampleName: 'sampleA' },
        { name: 'sampleB', sampleName: 'sampleB' },
      ],
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
      stopToken: createStopToken(),
      statusCallback: jest.fn(),
    })

    expect(model.setLayoutAndClusterTree).toHaveBeenCalledWith(
      [
        { name: 'sampleB HP1', sampleName: 'sampleB', HP: 1 },
        { name: 'sampleB HP0', sampleName: 'sampleB', HP: 0 },
        { name: 'sampleA HP1', sampleName: 'sampleA', HP: 1 },
        { name: 'sampleA HP0', sampleName: 'sampleA', HP: 0 },
      ],
      '(...);',
      // the recorded mode follows the run, since a phased tree clusters
      // haplotype rows rather than sample rows
      { ...PROVENANCE, settings: withMode('phased') },
    )
  })

  it('clusters the visible rows and keeps the hidden ones in the layout', async () => {
    // What a subtree filter leaves: sourcesBase is the filtered set, while
    // layout still records every row. The hidden row isn't clustered — it isn't
    // in the tree — but dropping it from layout would erase its position and
    // color for good once the filter is cleared.
    const model = makeModel({
      sourcesBase: [
        { name: 'sampleA', sampleName: 'sampleA' },
        { name: 'sampleB', sampleName: 'sampleB' },
      ],
      layout: [
        { name: 'sampleA' },
        { name: 'sampleB' },
        { name: 'sampleC', color: 'red' },
      ],
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
      stopToken: createStopToken(),
      statusCallback: jest.fn(),
    })

    expect(rpcManager.call).toHaveBeenCalledWith(
      'session-1',
      'MultiSampleVariantClusterGenotypeMatrix',
      expect.objectContaining({ sources: model.sourcesBase }),
    )
    expect(model.setLayoutAndClusterTree).toHaveBeenCalledWith(
      [
        { name: 'sampleB', sampleName: 'sampleB' },
        { name: 'sampleA', sampleName: 'sampleA' },
        { name: 'sampleC', color: 'red' },
      ],
      '(a,b);',
      PROVENANCE,
    )
  })
})
