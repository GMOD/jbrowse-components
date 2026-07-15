import { renameRegionIfNeeded, renameRegionsIfNeeded } from './renameRegions.ts'

import type { AssemblyManager, Region } from './types/index.ts'

const region: Region = {
  assemblyName: 'hg38',
  refName: 'chr1',
  start: 0,
  end: 1000,
}

function mockAssemblyManager({
  refNameMap,
  seqAdapterRefNameMap,
}: {
  refNameMap: Record<string, string>
  seqAdapterRefNameMap?: Record<string, string>
}) {
  return {
    waitForAssembly: async () => ({
      getRefNameMapForAdapter: async () => refNameMap,
      getSeqAdapterRefName: (canonical: string) =>
        seqAdapterRefNameMap?.[canonical] ?? canonical,
    }),
  } as unknown as AssemblyManager
}

async function renameRegion(
  refNameMap: Record<string, string>,
  seqAdapterRefNameMap?: Record<string, string>,
) {
  const result = await renameRegionsIfNeeded(
    mockAssemblyManager({
      refNameMap,
      seqAdapterRefNameMap,
    }),
    {
      adapterConfig: {},
      sessionId: 'test',
      regions: [region],
    },
  )
  return result.regions[0]!
}

test('renameRegionIfNeeded renames refName and stores original', () => {
  const result = renameRegionIfNeeded({ chr1: '1' }, region)
  expect(result.refName).toBe('1')
  expect(result.originalRefName).toBe('chr1')
})

test('renameRegionIfNeeded returns region unchanged when no mapping exists', () => {
  const result = renameRegionIfNeeded({}, region)
  expect(result.refName).toBe('chr1')
  expect(result.originalRefName).toBeUndefined()
})

test('renameRegionsIfNeeded resolves originalRefName to seq adapter refName', async () => {
  const r = await renameRegion({ chr1: '1' }, { chr1: '1' })
  expect(r.refName).toBe('1')
  expect(r.originalRefName).toBe('1')
})

test('renameRegionsIfNeeded sets originalRefName to FASTA name even when it differs from canonical', async () => {
  // CRAM uses 'chromosome1', FASTA uses '1'
  const r = await renameRegion({ chr1: 'chromosome1' }, { chr1: '1' })
  expect(r.refName).toBe('chromosome1')
  expect(r.originalRefName).toBe('1')
})

test('renameRegionsIfNeeded leaves originalRefName as canonical when names are not remapped', async () => {
  // no seqAdapterRefNameMap → getSeqAdapterRefName is identity
  const r = await renameRegion({ chr1: '1' })
  expect(r.refName).toBe('1')
  expect(r.originalRefName).toBe('chr1')
})

test('renameRegionsIfNeeded passes regions through unchanged when the assembly is not found', async () => {
  // waitForAssembly resolves undefined (assembly never registered) → both the
  // refName map and getSeqAdapterRefName are absent, so the region is untouched
  const result = await renameRegionsIfNeeded(
    { waitForAssembly: async () => undefined } as unknown as AssemblyManager,
    { adapterConfig: {}, sessionId: 'test', regions: [region] },
  )
  expect(result.regions[0]!.refName).toBe('chr1')
  expect(result.regions[0]!.originalRefName).toBeUndefined()
})

test('renameRegionsIfNeeded passes through regions that need no renaming', async () => {
  const r = await renameRegion({}, {})
  expect(r.refName).toBe('chr1')
  expect(r.originalRefName).toBeUndefined()
})

test('renameRegionsIfNeeded throws on a singular `region` with no `regions`', async () => {
  // guards the silent-skip footgun: a `region` field is never renamed (only
  // `regions` is), so fetching against it would use un-mapped refNames
  await expect(
    renameRegionsIfNeeded(mockAssemblyManager({ refNameMap: { chr1: '1' } }), {
      adapterConfig: {},
      sessionId: 'test',
      region,
    } as unknown as Parameters<typeof renameRegionsIfNeeded>[1]),
  ).rejects.toThrow(/singular .region./)
})

test('renameRegionsIfNeeded allows `region` mirrored into a populated `regions`', async () => {
  // the legitimate singular base class passes both; renaming uses `regions`
  const result = await renameRegionsIfNeeded(
    mockAssemblyManager({ refNameMap: { chr1: '1' } }),
    {
      adapterConfig: {},
      sessionId: 'test',
      region,
      regions: [region],
    } as unknown as Parameters<typeof renameRegionsIfNeeded>[1],
  )
  expect(result.regions[0]!.refName).toBe('1')
})
