import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

import {
  checkRef,
  fetchResults,
  splitLast,
  unanimousResult,
} from './searchUtils.ts'

import type { LinearGenomeViewModel } from './index.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// mirrors Assembly.getCanonicalRefName: a name resolves regardless of casing
const volvoxRefs = new Set(['ctgA', 'ctgB'])
const isRef = (name: string) =>
  [...volvoxRefs].some(r => r.toLowerCase() === name.toLowerCase())

// minimal stand-in exposing only the surface fetchResults reads
function fakeAssembly(
  allRefNames: string[],
  canonical: Record<string, string> = {},
) {
  return {
    load: async () => {},
    allRefNames,
    getCanonicalRefName2: (ref: string) => canonical[ref] ?? ref,
  } as unknown as Assembly
}

const assemblyName = 'volvox'

const labels = async (args: Parameters<typeof fetchResults>[0]) =>
  (await fetchResults(args)).map(r => r.getLabel())

describe('fetchResults refname matching', () => {
  it('returns refnames that prefix-match the query', async () => {
    expect(
      await labels({
        queryString: 'chr',
        assemblyName,
        assembly: fakeAssembly(['chr1', 'chr2', 'ctgA']),
      }),
    ).toEqual(['chr1', 'chr2'])
  })

  it('caps the number of refname hits', async () => {
    const refs = Array.from({ length: 50 }, (_, i) => `chr${i}`)
    expect(
      await labels({
        queryString: 'chr',
        assemblyName,
        assembly: fakeAssembly(refs),
      }),
    ).toHaveLength(10)
  })

  it('short-circuits instead of walking every refname once the cap is reached', async () => {
    const refs = Array.from({ length: 1000 }, (_, i) => `chr${i}`)
    const getCanonicalRefName2 = jest.fn((ref: string) => ref)
    const assembly = {
      load: async () => {},
      allRefNames: refs,
      getCanonicalRefName2,
    } as unknown as Assembly

    const results = await fetchResults({
      queryString: 'chr',
      assemblyName,
      assembly,
    })

    expect(results).toHaveLength(10)
    // resolution runs per match until the cap, so a 1000-entry all-matching
    // list must not be walked in full — proves the loop breaks
    expect(getCanonicalRefName2).toHaveBeenCalledTimes(10)
  })

  it('matches the whole name for an exact search', async () => {
    expect(
      await labels({
        queryString: 'chr1',
        searchType: 'exact',
        assemblyName,
        assembly: fakeAssembly(['chr1', 'chr10', 'chr11']),
      }),
    ).toEqual(['chr1'])
  })

  it('resolves aliases to a single canonical refname', async () => {
    expect(
      await labels({
        queryString: 'contig',
        assemblyName,
        assembly: fakeAssembly(['contigB', 'contigb'], {
          contigB: 'ctgB',
          contigb: 'ctgB',
        }),
      }),
    ).toEqual(['ctgB'])
  })

  // exactness rides on the hits so one unrestricted search answers both
  // questions handleSelectedRegion asks
  describe('exactness tagging', () => {
    const exactness = async (queryString: string, assembly: Assembly) =>
      Object.fromEntries(
        (await fetchResults({ queryString, assemblyName, assembly })).map(r => [
          r.getLabel(),
          r.isExact(),
        ]),
      )

    it('tags the whole-name match and not its prefixes', async () => {
      expect(
        await exactness('chr1', fakeAssembly(['chr1', 'chr10', 'chr11'])),
      ).toEqual({ chr1: true, chr10: false, chr11: false })
    })

    it('an alias matching exactly makes its canonical refname exact', async () => {
      // the canonical name is ctgB, which is not the query — but contigB is,
      // and that is the name the user typed
      expect(
        await exactness(
          'contigb',
          fakeAssembly(['contigB', 'contigBravo'], {
            contigB: 'ctgB',
            contigBravo: 'ctgB',
          }),
        ),
      ).toEqual({ ctgB: true })
    })

    it('collapsing an exact and an inexact alias keeps the hit exact', async () => {
      // scan order must not decide it: contigBravo is inexact and lands first
      expect(
        await exactness(
          'contigb',
          fakeAssembly(['contigBravo', 'contigB'], {
            contigB: 'ctgB',
            contigBravo: 'ctgB',
          }),
        ),
      ).toEqual({ ctgB: true })
    })
  })
})

describe('checkRef', () => {
  it('accepts a plain refName present in the set', () => {
    expect(checkRef('ctgA', isRef)).toBe(true)
  })

  it('accepts a lowercase variant present in the set', () => {
    expect(checkRef('ctga', isRef)).toBe(true)
  })

  it('accepts a locstring whose refName is in the set', () => {
    expect(checkRef('ctgA:1000', isRef)).toBe(true)
  })

  it('accepts a locstring with a range whose refName is in the set', () => {
    expect(checkRef('ctgA:1000-2000', isRef)).toBe(true)
  })

  it('rejects a gene label not in the ref set', () => {
    expect(checkRef('Apple3', isRef)).toBe(false)
  })

  it('rejects a locstring with a non-numeric suffix', () => {
    expect(checkRef('ctgA:notanumber', isRef)).toBe(false)
  })

  it('rejects an unknown refName even with a numeric suffix', () => {
    expect(checkRef('unknown:1000', isRef)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(checkRef('', isRef)).toBe(false)
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

describe('unanimousResult', () => {
  // only the two members unanimousResult reads
  const loadedAssembly = {
    initialized: true,
    isValidRefName: (refName: string) => isRef(refName),
    getCanonicalRefName2: (refName: string) =>
      [...volvoxRefs].find(r => r.toLowerCase() === refName.toLowerCase()) ??
      refName,
  } as unknown as Assembly

  // volvox's jb1 names index is the shape here: `missing` is indexed under a
  // track name no config claims, so it must not win the tie-break
  const configuredTracks = new Set(['genes', 'other_genes'])

  const viewWith = (openTrackIds: string[]) => ({
    model: {
      getTrack: (trackId: string) =>
        openTrackIds.includes(trackId) ? {} : undefined,
    } as unknown as LinearGenomeViewModel,
    session: {
      getTrackById: (trackId: string) =>
        configuredTracks.has(trackId) ? {} : undefined,
    } as unknown as AbstractSessionModel,
  })

  const hit = (locString: string, trackId?: string) =>
    new BaseResult({ label: 'EDEN.1', locString, trackId })

  const pick = (results: BaseResult[], openTrackIds: string[] = []) =>
    unanimousResult({
      results,
      assembly: loadedAssembly,
      ...viewWith(openTrackIds),
    })

  it('collapses hits that name one feature in one place', () => {
    const results = [
      hit('ctgA:1049..9000', 'genes'),
      hit('ctgA:1049..9000', 'other_genes'),
    ]
    expect(pick(results)).toBe(results[0])
  })

  it('prefers the hit whose track the view already has open', () => {
    const results = [
      hit('ctgA:1049..9000', 'genes'),
      hit('ctgA:1049..9000', 'other_genes'),
    ]
    expect(pick(results, ['other_genes'])).toBe(results[1])
  })

  it('skips a hit indexed under a track no config claims', () => {
    const results = [
      hit('ctgA:1049..9000', 'missing'),
      hit('ctgA:1049..9000', 'genes'),
    ]
    expect(pick(results)).toBe(results[1])
  })

  it('sees through two spellings of one location', () => {
    expect(
      pick([hit('ctgA:1049-9000', 'genes'), hit('ctga:1,049..9,000', 'genes')]),
    ).toBeDefined()
  })

  it('keeps the picker for hits in different places', () => {
    expect(
      pick([
        hit('ctgA:1049..9000', 'genes'),
        hit('ctgA:20000..30000', 'genes'),
      ]),
    ).toBeUndefined()
  })

  it('keeps the picker for different features at one place', () => {
    expect(
      pick([
        new BaseResult({ label: 'EDEN.1', locString: 'ctgA:1..100' }),
        new BaseResult({ label: 'EDEN.2', locString: 'ctgA:1..100' }),
      ]),
    ).toBeUndefined()
  })

  // an unloaded assembly cannot canonicalize, so two spellings stay two
  // destinations and the picker asks — an unprovable match must not merge
  it('keeps the picker when the assembly cannot resolve the names', () => {
    expect(
      unanimousResult({
        results: [
          hit('ctgA:1049-9000', 'genes'),
          hit('ctga:1,049..9,000', 'other_genes'),
        ],
        assembly: undefined,
        ...viewWith([]),
      }),
    ).toBeUndefined()
  })

  it('keeps the picker for hits carrying no location', () => {
    expect(
      pick([
        new BaseResult({ label: 'EDEN.1' }),
        new BaseResult({ label: 'EDEN.1' }),
      ]),
    ).toBeUndefined()
  })
})
