import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

const region = {
  refName: 'ctgA',
  start: 0,
  end: 1_000_000,
  assemblyName: 'volvox',
}

// An adapter that records which of its two entry points were reached, so a test
// can assert that the expensive one wasn't.
function spyAdapter(bytes: number | undefined) {
  const calls: string[] = []
  return {
    calls,
    adapter: {
      getRegionByteSize: (..._a: unknown[]) => {
        calls.push('getRegionByteSize')
        return Promise.resolve(bytes)
      },
      getFeaturesArray: (..._a: unknown[]) => {
        calls.push('getFeaturesArray')
        return Promise.resolve([])
      },
    } as unknown as BaseFeatureDataAdapter,
  }
}

// The byte stage is the reason a gated display can keep fetching while its
// banner holds: `FetchVisibleRegions` re-runs the ordinary fetch once per
// settled viewport to re-measure, and that is only affordable because an
// over-budget region turns back here, before any features are downloaded (see
// agent-docs/reference/REGION_TOO_LARGE.md § "Measurement follows the
// viewport"). Moving this stage below the feature fetch would make every blocked
// track download its whole region on every pan — silently, since the verdict and
// the banner would look identical.
describe('measureRegionBytes', () => {
  it('reports an over-budget region without downloading features', async () => {
    const { adapter, calls } = spyAdapter(8_000_000)
    const result = await measureRegionBytes({
      dataAdapter: adapter,
      regions: [region],
      byteLimit: 5_000_000,
    })
    expect(result).toEqual({
      bytes: 8_000_000,
      tooLarge: { regionTooLarge: true, bytes: 8_000_000 },
    })
    expect(calls).toEqual(['getRegionByteSize'])
  })

  it('carries the measurement through when the region fits', async () => {
    const { adapter, calls } = spyAdapter(1_000_000)
    const result = await measureRegionBytes({
      dataAdapter: adapter,
      regions: [region],
      byteLimit: 5_000_000,
    })
    // `bytes` comes back either way — the main-thread gate stores it whether or
    // not this region tripped, which is what makes the next verdict a
    // measurement rather than a memory.
    expect(result).toEqual({ bytes: 1_000_000 })
    expect(calls).toEqual(['getRegionByteSize'])
  })

  // The budget is undefined exactly when the byte axis is off — force-loaded.
  // Measuring anyway would spend an index read per region on a number nothing
  // can act on, and `commitGateMeasurements` would then have to tell a real
  // measurement from a budget-less one.
  it('measures nothing at all when there is no budget', async () => {
    const { adapter, calls } = spyAdapter(8_000_000)
    expect(
      await measureRegionBytes({
        dataAdapter: adapter,
        regions: [region],
        byteLimit: undefined,
      }),
    ).toEqual({})
    expect(calls).toEqual([])
  })

  // A self-summarizing adapter (BigWig, HiC, sequence) implements no
  // `getRegionByteSize`, so the base class returns undefined. That is
  // "unmeasurable", not "zero bytes": the region must go through to the fetch,
  // and the byte axis must stay out of the verdict.
  it('lets an adapter with no index estimate through, measuring nothing', async () => {
    const { adapter, calls } = spyAdapter(undefined)
    expect(
      await measureRegionBytes({
        dataAdapter: adapter,
        regions: [region],
        byteLimit: 5_000_000,
      }),
    ).toEqual({ bytes: undefined })
    expect(calls).toEqual(['getRegionByteSize'])
  })
})
