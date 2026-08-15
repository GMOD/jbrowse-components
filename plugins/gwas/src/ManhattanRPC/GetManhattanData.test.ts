import PluginManager from '@jbrowse/core/PluginManager'

import GetManhattanData from './GetManhattanData.ts'

import type { GetManhattanDataArgs } from './rpcTypes.ts'

// Two files, two spellings of one contig. The assembly canonicalizes to `1`;
// the GWAS summary stats say `GWAS_1` and the PLINK `.ld` says `chr1`. Nothing
// about `GWAS_1` is realistic — that is the point. A map keyed by the canonical
// name has no entry under it, so any pass that starts from the GWAS-renamed
// region instead of the canonical one falls through unchanged and is caught.
const CANONICAL = '1'
const MAPS: Record<string, Record<string, string>> = {
  GWASAdapter: { [CANONICAL]: 'GWAS_1' },
  PlinkLDAdapter: { [CANONICAL]: 'chr1' },
}

const GWAS_ADAPTER = { type: 'GWASAdapter' }
const LD_ADAPTER = { type: 'PlinkLDAdapter' }

function setup() {
  const pluginManager = new PluginManager()
  const getRefNameMapForAdapter = jest.fn(
    (adapterConf: { type?: unknown }) => MAPS[String(adapterConf.type)] ?? {},
  )
  ;(pluginManager as { rootModel: unknown }).rootModel = {
    session: {
      assemblyManager: {
        requireAssembly: () =>
          Promise.resolve({
            getRefNameMapForAdapter,
            getSeqAdapterRefName: (r: string) => r,
          }),
      },
    },
  }
  return { rpc: new GetManhattanData(pluginManager), getRefNameMapForAdapter }
}

function args(overrides: Partial<GetManhattanDataArgs> = {}) {
  return {
    sessionId: 'testSession',
    adapterConfig: GWAS_ADAPTER,
    region: {
      refName: CANONICAL,
      start: 0,
      end: 1000,
      assemblyName: 'hg38',
    },
    color: 'red',
    colorBy: 'ld' as const,
    indexSnp: 'rsIndex',
    ldAdapterConfig: LD_ADAPTER,
    ...overrides,
  }
}

// The half of the LD refName fix that lives on the main thread. `buildLdToIndex`
// is covered in ldToIndex.test.ts; what is covered here is that it is handed the
// right name in the first place — the crossing that actually shipped broken.
describe('serializeArguments resolves the LD adapter its own refName', () => {
  it('renames the region for the GWAS file and the LD name for the LD file', async () => {
    const { rpc } = setup()
    const out = await rpc.serializeArguments(args())
    expect(out.region).toMatchObject({ refName: 'GWAS_1' })
    expect(out.ldRefName).toBe('chr1')
  })

  it('resolves ldRefName from the canonical region, not the renamed one', async () => {
    const { rpc, getRefNameMapForAdapter } = setup()
    const out = await rpc.serializeArguments(args())
    // The LD pass must be fed `1`, not `GWAS_1`. Feeding it the already-renamed
    // region finds no entry in a canonically-keyed map, so the region comes back
    // untouched and ldRefName would be `GWAS_1` — the same bug in a new spelling,
    // with every ldToIndex test still green.
    expect(out.ldRefName).not.toBe('GWAS_1')
    expect(getRefNameMapForAdapter).toHaveBeenCalledWith(
      LD_ADAPTER,
      expect.anything(),
    )
  })

  it('never touches the LD adapter in normal coloring mode', async () => {
    const { rpc, getRefNameMapForAdapter } = setup()
    const out = await rpc.serializeArguments(args({ colorBy: 'normal' }))
    expect(out.ldRefName).toBeUndefined()
    // Not just "no name resolved": no refName map resolved at all. That call is
    // a CoreGetRefNames round trip, and for the in-memory PLINK adapter it parses
    // the whole `.ld` file — a download a normally-colored track must not pay.
    expect(getRefNameMapForAdapter).not.toHaveBeenCalledWith(
      LD_ADAPTER,
      expect.anything(),
    )
  })

  it.each([
    ['no index SNP', { indexSnp: undefined }],
    ['no LD adapter configured', { ldAdapterConfig: undefined }],
  ])('skips the LD pass with %s', async (_label, override) => {
    const { rpc, getRefNameMapForAdapter } = setup()
    const out = await rpc.serializeArguments(args(override))
    expect(out.ldRefName).toBeUndefined()
    expect(getRefNameMapForAdapter).not.toHaveBeenCalledWith(
      LD_ADAPTER,
      expect.anything(),
    )
  })

  it('renames a chr:bp index SNP through the GWAS pass, not the LD one', async () => {
    const { rpc } = setup()
    const out = await rpc.serializeArguments(
      args({ indexSnp: `${CANONICAL}:100` }),
    )
    // The index is compared against GWAS features in the worker, so it lands in
    // the GWAS file's scheme — while the query that fetches the LD records uses
    // the LD file's. Both names, one call, each pointed at its own file.
    expect(out.indexSnp).toBe('GWAS_1:100')
    expect(out.ldRefName).toBe('chr1')
  })
})
