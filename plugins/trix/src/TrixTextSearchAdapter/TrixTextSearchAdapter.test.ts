import path from 'node:path'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

import Adapter, { shorten } from './TrixTextSearchAdapter.ts'
import configSchema, { normalizeSnapshot } from './configSchema.ts'

describe('normalizeSnapshot uri shorthand', () => {
  it('derives ixx and _meta.json siblings from the .ix uri', () => {
    expect(normalizeSnapshot({ type: 'TrixTextSearchAdapter', uri: 'x.ix' }))
      .toMatchObject({
        ixFilePath: { uri: 'x.ix' },
        ixxFilePath: { uri: 'x.ixx' },
        metaFilePath: { uri: 'x_meta.json' },
      })
  })

  it('leaves explicit file paths untouched when no uri given', () => {
    const snap = { type: 'TrixTextSearchAdapter', ixFilePath: { uri: 'a.ix' } }
    expect(normalizeSnapshot(snap)).toBe(snap)
  })
})

describe('shorten', () => {
  it('returns string as-is when shorter than 40 chars', () => {
    expect(shorten('short text', 'text')).toBe('short text')
  })

  it('truncates from start when term not found', () => {
    expect(shorten('a'.repeat(50), 'xyz')).toBe(`${'a'.repeat(40)}...`)
  })

  it('shows context window around term in the middle', () => {
    expect(shorten('the quick brown fox jumped over the lazy dog', 'fox')).toBe(
      '...he quick brown fox jumped over th...',
    )
  })

  it('no leading ellipsis when term is near the start', () => {
    expect(
      shorten('foobar jumps over the quick brown lazy dog12', 'foobar'),
    ).toBe('foobar jumps over the...')
  })

  it('no trailing ellipsis when term is near the end', () => {
    expect(
      shorten('the quick brown lazy dog jumps over foobar', 'foobar'),
    ).toBe('...dog jumps over foobar')
  })
})

describe('TrixTextSearchAdapter', () => {
  const adapter = new Adapter(
    configSchema.create({
      type: 'TrixTextSearchAdapter',
      textSearchAdapterId: 'TrixTextSearchAdapterTest',
      ixFilePath: {
        localPath: path.resolve(__dirname, 'test_data/volvox.ix'),
        locationType: 'LocalPathLocation',
      },
      ixxFilePath: {
        localPath: path.resolve(__dirname, 'test_data/volvox.ixx'),
        locationType: 'LocalPathLocation',
      },
      metaFilePath: {
        localPath: path.resolve(__dirname, 'test_data/volvox_meta.json'),
        locationType: 'LocalPathLocation',
      },
    }),
  )

  it('prefix search returns BaseResult instances with correct labels', async () => {
    const results = await adapter.searchIndex({ queryString: 'apple' })
    expect(results[0] instanceof BaseResult).toBeTruthy()
    expect(results[0]!.getLabel()).toEqual('Apple2')
    expect(results[1]!.getLabel()).toEqual('Apple3')
  })

  it('prefix search result has correct location and displayString', async () => {
    const results = await adapter.searchIndex({ queryString: 'apple3' })
    expect(results[0]!.getLocation()).toEqual('ctgA:17400..23000')
    expect(results[0]!.getDisplayString()).toEqual('Apple3')
  })

  it('multi-word search keeps only entries containing every word', async () => {
    // "eden" alone matches EDEN (protein kinase) + EDEN.1/.2/.3 (splice forms);
    // adding "splice" drops the bare EDEN entry
    const results = await adapter.searchIndex({ queryString: 'eden splice' })
    expect(results.map(r => r.getLabel()).sort()).toEqual([
      'EDEN.1',
      'EDEN.2',
      'EDEN.3',
    ])
  })

  it('multi-word search matches attributes, not the internal trackId', async () => {
    // trackId is "gff3tabix_genes"; "genes" must not satisfy a search word
    const results = await adapter.searchIndex({ queryString: 'eden genes' })
    expect(results).toEqual([])
  })

  it('exact search filters to only exact label matches', async () => {
    const results = await adapter.searchIndex({
      queryString: 'apple3',
      searchType: 'exact',
    })
    expect(results.length).toEqual(1)
    expect(results[0]!.getLabel()).toEqual('Apple3')
    expect(results[0]!.getLocation()).toEqual('ctgA:17400..23000')
  })

  it('exact search matches a non-label attribute such as the ID', async () => {
    // "rna-Apple3" is the ID, not the displayed label ("Apple3")
    const results = await adapter.searchIndex({
      queryString: 'rna-Apple3',
      searchType: 'exact',
    })
    expect(results.length).toEqual(1)
    expect(results[0]!.getLabel()).toEqual('Apple3')
    expect(results[0]!.getLocation()).toEqual('ctgA:17400..23000')
  })
})
