import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import CoreGetRegionByteEstimate from './CoreGetRegionByteEstimate.ts'

import type PluginManager from '../../PluginManager.ts'
import type { RpcArgs } from '../RpcRegistry.ts'

jest.mock('../../data_adapters/dataAdapterCache.ts', () => ({
  getAdapter: jest.fn(),
}))

const mockGetAdapter = jest.mocked(getAdapter)

const region = (refName: string) => ({
  refName,
  start: 0,
  end: 1000,
  assemblyName: 'volvox',
})

function run(
  dataAdapter: unknown,
  {
    scope = 'wholeRequest',
    regions = [region('ctgA')],
  }: Partial<
    Pick<RpcArgs<'CoreGetRegionByteEstimate'>, 'scope' | 'regions'>
  > = {},
) {
  const method = new CoreGetRegionByteEstimate({} as PluginManager)
  mockGetAdapter.mockResolvedValue({ dataAdapter } as Awaited<
    ReturnType<typeof getAdapter>
  >)
  return method.invoke({
    sessionId: 's',
    adapterConfig: { type: 'AnyAdapter' },
    regions,
    scope,
  })
}

describe('CoreGetRegionByteEstimate', () => {
  it('returns the adapter estimate for an indexed feature adapter', async () => {
    await expect(
      run({ getFeatures: () => {}, getRegionByteSize: async () => 4096 }),
    ).resolves.toBe(4096)
  })

  // An adapter that caps what it returns at screen resolution (BigWig, HiC,
  // sequence) implements no estimate. `undefined` is not a failure — it is the
  // gate's "no byte axis", and `estimatedFetchBytes` being undefined is what
  // keeps such a track from ever bannering.
  it('returns undefined for a feature adapter with no index estimate', async () => {
    await expect(
      run({ getFeatures: () => {}, getRegionByteSize: async () => undefined }),
    ).resolves.toBeUndefined()
  })

  // The regression: this used to throw "Adapter does not support retrieving
  // features" for an adapter serving something other than features
  // (PlinkLD*/Ldmat serve precomputed LD pairs). That made "can this be
  // measured" a question the *display* had to answer before asking, and the
  // only tool it had was turning `measuresBytesPreFlight` off — abandoning the whole
  // gate for one adapter family. Answering `undefined` puts the capability
  // question where the capability lives, and lands it on the same "no byte
  // axis" path an estimate-less feature adapter already takes.
  it('returns undefined for an adapter that serves no features at all', async () => {
    await expect(
      run({ getRefNames: async () => ['ctgA'] }),
    ).resolves.toBeUndefined()
  })
})

// A byte budget has a scope, and this RPC serves both of the ones in the tree:
// the gate's, enforced once per region, and the save dialog's, on the whole
// download. The scope used to be implicit — `getRegionByteSize` merges and sums
// by construction, so the gate silently got the wrong one and a whole-genome VCF
// bannered on a total no single region came close to.
describe('budget scope', () => {
  // The adapter is asked per region under `largestRegion`, so the stub answers
  // per region and the two scopes have different right answers.
  const perRegionAdapter = (bytes: Record<string, number | undefined>) => ({
    getFeatures: () => {},
    getRegionByteSize: async (regions: { refName: string }[]) =>
      regions.reduce<number | undefined>((acc, r) => {
        const b = bytes[r.refName]
        return b === undefined ? acc : (acc ?? 0) + b
      }, undefined),
  })

  const regions = [region('ctgA'), region('ctgB'), region('ctgC')]

  it('takes the biggest single region for a per-region budget', async () => {
    await expect(
      run(perRegionAdapter({ ctgA: 300, ctgB: 900, ctgC: 500 }), {
        scope: 'largestRegion',
        regions,
      }),
    ).resolves.toBe(900)
  })

  it('takes the whole merged download for a whole-request budget', async () => {
    await expect(
      run(perRegionAdapter({ ctgA: 300, ctgB: 900, ctgC: 500 }), {
        scope: 'wholeRequest',
        regions,
      }),
    ).resolves.toBe(1700)
  })

  // The reduction has to skip an unmeasurable region rather than read it as
  // zero, and answer "unmeasurable" only when every region is — otherwise a
  // mixed set would gate against a number that left regions out, or a wholly
  // unmeasurable one would read as a region that comfortably fits.
  it('ignores unmeasurable regions but keeps the measured ones', async () => {
    await expect(
      run(perRegionAdapter({ ctgA: undefined, ctgB: 900, ctgC: undefined }), {
        scope: 'largestRegion',
        regions,
      }),
    ).resolves.toBe(900)
  })

  it('is unmeasurable, not zero, when no region can be measured', async () => {
    await expect(
      run(perRegionAdapter({}), { scope: 'largestRegion', regions }),
    ).resolves.toBeUndefined()
  })
})
