import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createStopToken } from '@jbrowse/core/util/stopToken'

import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './components/MultiSampleVariantClusterDialog/types.ts'
import type { ClusterGenotypeMatrixCaller } from './runGenotypeClustering.ts'

// adapterConfig is forwarded to the RPC call opaquely (never read by
// runGenotypeClustering), so a minimal real config instance stands in for a
// real adapter's.
const adapterConfig = ConfigurationSchema('TestAdapter', {}).create({
  type: 'TestAdapter',
})

const regions = [{ assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 }]

function makeModel(overrides: Partial<ReducedModel> = {}): ReducedModel {
  return {
    layout: [],
    sourcesVolatile: [
      { name: 'sampleA' },
      { name: 'sampleB' },
      { name: 'sampleC' },
    ],
    adapterConfig,
    renderingMode: 'alleleCount',
    setClusterTree: jest.fn(),
    setLayout: jest.fn(),
    setLayoutAndPendingClusterTree: jest.fn(),
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
        sources: model.sourcesVolatile,
        minorAlleleFrequencyFilter: 0,
        maxMissingnessFilter: 1,
        renderingMode: 'alleleCount',
      }),
    )
    expect(model.setLayoutAndPendingClusterTree).toHaveBeenCalledWith(
      [{ name: 'sampleC' }, { name: 'sampleA' }, { name: 'sampleB' }],
      '(a,b,c);',
    )
  })

  it('passes through explicit filter values instead of the RPC defaults', async () => {
    const model = makeModel({
      minorAlleleFrequencyFilter: 0.05,
      maxMissingnessFilter: 0.2,
    })
    const rpcManager = makeRpcManager(async () => ({ order: [0], tree: ';' }))

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

  it('does nothing when sourcesVolatile is not yet loaded', async () => {
    const model = makeModel({ sourcesVolatile: undefined })
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
    expect(model.setLayoutAndPendingClusterTree).not.toHaveBeenCalled()
  })

  it('expands sources into per-haplotype rows before laying out, in phased mode', async () => {
    const model = makeModel({
      sourcesVolatile: [{ name: 'sampleA' }, { name: 'sampleB' }],
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

    expect(model.setLayoutAndPendingClusterTree).toHaveBeenCalledWith(
      [
        { name: 'sampleB HP1', sampleName: 'sampleB', HP: 1 },
        { name: 'sampleB HP0', sampleName: 'sampleB', HP: 0 },
        { name: 'sampleA HP1', sampleName: 'sampleA', HP: 1 },
        { name: 'sampleA HP0', sampleName: 'sampleA', HP: 0 },
      ],
      '(...);',
    )
  })
})
