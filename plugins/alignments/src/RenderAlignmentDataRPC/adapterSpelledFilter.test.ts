import { SimpleFeature } from '@jbrowse/core/util'

import { adapterSpelledFilter } from './adapterSpelledFilter.ts'
import { filterChainFeatures } from './filterChainFeatures.ts'

import type { SpellingAssemblies } from './adapterSpelledFilter.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// An assembly canonicalized `chr9` over a BAM whose header spells it `9`
const CANONICAL: Record<string, string> = { '9': 'chr9', chr9: 'chr9' }
const ADAPTER_NAMES = { chr9: '9', chr1: '1' }

function assemblies() {
  const requireAssembly = jest.fn(async () => ({
    getCanonicalRefName2: (refName: string) => CANONICAL[refName] ?? refName,
    getRefNameMapForAdapter: async () => ADAPTER_NAMES,
  }))
  const source: SpellingAssemblies = { requireAssembly }
  return { source, requireAssembly }
}

function argsWith(filter: FieldPredicate[]) {
  return {
    sessionId: 'sess',
    adapterConfig: { type: 'BamAdapter' },
    regions: [{ assemblyName: 'hg38', refName: 'chr1', start: 0, end: 100 }],
    filter,
  }
}

// a read on the adapter's `1` whose mate the file names `mate`
function read(name: string, mate: string) {
  return new SimpleFeature({
    uniqueId: name,
    refName: '1',
    start: 0,
    end: 100,
    name,
    flags: 0x1,
    next_ref: mate,
  })
}

const READS = [read('onNine', '9'), read('onOne', '1'), read('onX', 'X')]

test.each([
  ['the canonical name', 'chr9'],
  ['the file spelling', '9'],
])('%s keeps the mates the file names 9', async (_, written) => {
  const { filter } = await adapterSpelledFilter(
    assemblies().source,
    argsWith([{ field: 'mateRefName', equal: written }]),
  )
  expect(filterChainFeatures(READS, filter).map(f => f.id())).toEqual([
    'onNine',
  ])
})

test('a name the assembly does not have is kept as written', async () => {
  const { filter } = await adapterSpelledFilter(
    assemblies().source,
    argsWith([{ field: 'mateRefName', oneOf: ['chr9', 'HG002#1#chr3'] }]),
  )
  expect(filter).toEqual([
    { field: 'mateRefName', oneOf: ['chr9', '9', 'HG002#1#chr3'] },
  ])
})

test('a filter naming no mate reference reads no assembly', async () => {
  const { source, requireAssembly } = assemblies()
  const args = argsWith([{ field: 'pairing', equal: 'discordant' }])
  expect(await adapterSpelledFilter(source, args)).toBe(args)
  expect(requireAssembly).not.toHaveBeenCalled()
})
