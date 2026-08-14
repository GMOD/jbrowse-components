import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import { loadRefNameMap } from './loadRefNameMap.ts'

import type { RefNameMapAssembly } from './loadRefNameMap.ts'

const adapterConfig = { type: 'BamAdapter', bamLocation: { uri: 'x.bam' } }

function setup({
  fileRefNames,
  assemblyRefNames,
  aliases = {},
}: {
  fileRefNames: string[]
  assemblyRefNames: string[]
  aliases?: Record<string, string>
}) {
  const setRefNameMismatch = jest.fn()
  const assembly = {
    name: 'hg38',
    load: async () => {},
    error: undefined,
    configuration: undefined,
    regions: assemblyRefNames.map(refName => ({ refName })),
    refNames: assemblyRefNames,
    refNameAliases: Object.fromEntries(
      assemblyRefNames.map(n => [n, n] as const),
    ),
    rpcManager: { call: async () => fileRefNames },
    getCanonicalRefName: (name: string) =>
      assemblyRefNames.includes(name) ? name : aliases[name],
    setRefNameMismatch,
  } as unknown as RefNameMapAssembly
  return { assembly, setRefNameMismatch }
}

const CHR = ['chr1', 'chr2', 'chr3']

test('records the mismatch when nothing canonicalizes, and still returns the map', async () => {
  const { assembly, setRefNameMismatch } = setup({
    fileRefNames: ['1', '2', '3'],
    assemblyRefNames: CHR,
  })

  // the diagnostic is not a gate: the map comes back whole, so the track loads,
  // fetches and draws whatever it can. It is the identity map that makes this a
  // problem worth reporting — no region will ever hit one of these keys
  const result = await loadRefNameMap(assembly, adapterConfig, {
    sessionId: 'sesh',
  })
  expect(result).toEqual({ 1: '1', 2: '2', 3: '3' })

  expect(setRefNameMismatch).toHaveBeenCalledTimes(1)
  const [key, mismatch] = setRefNameMismatch.mock.calls[0]!
  // Keyed the way the map load itself is keyed, which is also what a track
  // computes as its `rpcSessionId` — that identity is the whole lookup, since
  // nothing here can reach a track. Compared against a structural CLONE rather
  // than the same object, because the track and the RPC each read their own
  // `getConf(track, 'adapter')` snapshot: it is value-stability, not object
  // identity, that makes the track find its own record.
  expect(key).toBe(adapterConfigCacheKey(structuredClone(adapterConfig)))
  expect(mismatch).toMatchObject({
    assemblyName: 'hg38',
    adapter: { names: ['1', '2', '3'], total: 3 },
  })
})

// Partial overlap is what most real tracks look like. Reporting on it would fire
// on a sample-specific VCF, a chr1-only test file, or any track that stops at
// the primary assembly.
test('does not record on partial overlap', async () => {
  const { assembly, setRefNameMismatch } = setup({
    fileRefNames: ['chr1', 'chrUn_scaffold_9'],
    assemblyRefNames: CHR,
  })
  const result = await loadRefNameMap(assembly, adapterConfig, {
    sessionId: 'sesh',
  })
  expect(result).toEqual({
    chr1: 'chr1',
    chrUn_scaffold_9: 'chrUn_scaffold_9',
  })
  expect(setRefNameMismatch).not.toHaveBeenCalled()
})

test('does not record when refNameAliases already resolve the file names', async () => {
  const { assembly, setRefNameMismatch } = setup({
    fileRefNames: ['1', '2', '3'],
    assemblyRefNames: CHR,
    aliases: { 1: 'chr1', 2: 'chr2', 3: 'chr3' },
  })
  const result = await loadRefNameMap(assembly, adapterConfig, {
    sessionId: 'sesh',
  })
  expect(result).toEqual({ chr1: '1', chr2: '2', chr3: '3' })
  expect(setRefNameMismatch).not.toHaveBeenCalled()
})

// An adapter that is not a refName source answers [] rather than failing, so an
// empty file-side list says nothing about the configuration
test('does not record when the adapter reports no refNames', async () => {
  const { assembly, setRefNameMismatch } = setup({
    fileRefNames: [],
    assemblyRefNames: CHR,
  })
  expect(
    await loadRefNameMap(assembly, adapterConfig, { sessionId: 'sesh' }),
  ).toEqual({})
  expect(setRefNameMismatch).not.toHaveBeenCalled()
})
