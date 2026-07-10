import { checkRef, fetchResults, splitLast } from './searchUtils.ts'

import type { SearchScope } from '@jbrowse/core/TextSearch/TextSearchManager'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

const volvoxRefs = new Set(['ctgA', 'ctgB', 'ctga', 'ctgb'])

// minimal stand-in exposing only the surface fetchResults reads
function fakeAssembly(
  allRefNames: string[],
  canonical: Record<string, string> = {},
) {
  return {
    load: async () => {},
    allRefNames,
    getCanonicalRefName: (ref: string) => canonical[ref] ?? ref,
  } as unknown as Assembly
}

const searchScope: SearchScope = {
  includeAggregateIndexes: true,
  assemblyName: 'volvox',
}

const labels = async (args: Parameters<typeof fetchResults>[0]) =>
  (await fetchResults(args)).map(r => r.getLabel())

describe('fetchResults refname matching', () => {
  it('returns refnames that prefix-match the query', async () => {
    expect(
      await labels({
        queryString: 'chr',
        searchScope,
        assembly: fakeAssembly(['chr1', 'chr2', 'ctgA']),
      }),
    ).toEqual(['chr1', 'chr2'])
  })

  it('caps the number of refname hits', async () => {
    const refs = Array.from({ length: 50 }, (_, i) => `chr${i}`)
    expect(
      await labels({ queryString: 'chr', searchScope, assembly: fakeAssembly(refs) }),
    ).toHaveLength(10)
  })

  it('short-circuits instead of walking every refname once the cap is reached', async () => {
    const refs = Array.from({ length: 1000 }, (_, i) => `chr${i}`)
    const getCanonicalRefName = jest.fn((ref: string) => ref)
    const assembly = {
      load: async () => {},
      allRefNames: refs,
      getCanonicalRefName,
    } as unknown as Assembly

    const results = await fetchResults({
      queryString: 'chr',
      searchScope,
      assembly,
    })

    expect(results).toHaveLength(10)
    // resolution runs per match until the cap, so a 1000-entry all-matching
    // list must not be walked in full — proves the loop breaks
    expect(getCanonicalRefName).toHaveBeenCalledTimes(10)
  })

  it('matches the whole name for an exact search', async () => {
    expect(
      await labels({
        queryString: 'chr1',
        searchType: 'exact',
        searchScope,
        assembly: fakeAssembly(['chr1', 'chr10', 'chr11']),
      }),
    ).toEqual(['chr1'])
  })

  it('resolves aliases to a single canonical refname', async () => {
    expect(
      await labels({
        queryString: 'contig',
        searchScope,
        assembly: fakeAssembly(['contigB', 'contigb'], {
          contigB: 'ctgB',
          contigb: 'ctgB',
        }),
      }),
    ).toEqual(['ctgB'])
  })
})

describe('checkRef', () => {
  it('accepts a plain refName present in the set', () => {
    expect(checkRef('ctgA', volvoxRefs)).toBe(true)
  })

  it('accepts a lowercase variant present in the set', () => {
    expect(checkRef('ctga', volvoxRefs)).toBe(true)
  })

  it('accepts a locstring whose refName is in the set', () => {
    expect(checkRef('ctgA:1000', volvoxRefs)).toBe(true)
  })

  it('accepts a locstring with a range whose refName is in the set', () => {
    expect(checkRef('ctgA:1000-2000', volvoxRefs)).toBe(true)
  })

  it('rejects a gene label not in the ref set', () => {
    expect(checkRef('Apple3', volvoxRefs)).toBe(false)
  })

  it('rejects a locstring with a non-numeric suffix', () => {
    expect(checkRef('ctgA:notanumber', volvoxRefs)).toBe(false)
  })

  it('rejects an unknown refName even with a numeric suffix', () => {
    expect(checkRef('unknown:1000', volvoxRefs)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(checkRef('', volvoxRefs)).toBe(false)
  })
})

describe('splitLast', () => {
  it('splits on the last colon', () => {
    expect(splitLast('ctgA:1000:extra', ':')).toEqual(['ctgA:1000', 'extra'])
  })

  it('returns [str, empty] when separator not found', () => {
    expect(splitLast('ctgA', ':')).toEqual(['ctgA', ''])
  })

  it('splits a simple locstring', () => {
    expect(splitLast('ctgA:1000', ':')).toEqual(['ctgA', '1000'])
  })
})
