import { renameRegionIfNeeded, renameRegionsIfNeeded } from './index.ts'

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
    getRefNameMapForAdapter: async () => refNameMap,
    get: () =>
      seqAdapterRefNameMap
        ? {
            getSeqAdapterRefName: (canonical: string) =>
              seqAdapterRefNameMap[canonical] ?? canonical,
          }
        : undefined,
  } as unknown as AssemblyManager
}

async function renameRegion(
  refNameMap: Record<string, string>,
  seqAdapterRefNameMap?: Record<string, string>,
) {
  const result = await renameRegionsIfNeeded(
    mockAssemblyManager({ refNameMap, seqAdapterRefNameMap }),
    { adapterConfig: {}, sessionId: 'test', regions: [region] },
  )
  return result.regions[0]! as Region & { originalRefName?: string }
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

test('renameRegionsIfNeeded leaves originalRefName as canonical when no assembly found', async () => {
  // no seqAdapterRefNameMap → get() returns undefined
  const r = await renameRegion({ chr1: '1' })
  expect(r.refName).toBe('1')
  expect(r.originalRefName).toBe('chr1')
})

test('renameRegionsIfNeeded passes through regions that need no renaming', async () => {
  const r = await renameRegion({}, {})
  expect(r.refName).toBe('chr1')
  expect(r.originalRefName).toBeUndefined()
})
