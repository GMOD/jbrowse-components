import path from 'path'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

import Adapter from './TrixTextSearchAdapter.ts'
import { shorten } from './TrixTextSearchAdapter.ts'
import configSchema from './configSchema.ts'

describe('shorten', () => {
  it('returns string as-is when shorter than 40 chars', () => {
    expect(shorten('short text', 'text')).toBe('short text')
  })

  it('truncates from start when term not found', () => {
    expect(shorten('a'.repeat(50), 'xyz')).toBe(`${'a'.repeat(40)}...`)
  })

  it('shows context window around term in the middle', () => {
    expect(
      shorten('the quick brown fox jumped over the lazy dog', 'fox'),
    ).toBe('...he quick brown fox jumped over...')
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

  it('exact search filters to only exact label matches', async () => {
    const results = await adapter.searchIndex({
      queryString: 'apple3',
      searchType: 'exact',
    })
    expect(results.length).toEqual(1)
    expect(results[0]!.getLabel()).toEqual('Apple3')
    expect(results[0]!.getLocation()).toEqual('ctgA:17400..23000')
  })
})
