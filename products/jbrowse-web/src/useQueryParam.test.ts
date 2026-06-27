import { describe, expect, it } from '@jest/globals'

import {
  deleteQueryParams,
  readQueryParams,
  setQueryParams,
} from './useQueryParam.ts'

function setUrl(url: string) {
  window.history.replaceState(null, '', url)
}

describe('useQueryParam reads/writes query string and hash fragment', () => {
  it('reads params from the query string (legacy URLs)', () => {
    setUrl('/app/?config=conf.json&session=spec-abc')
    expect(readQueryParams(['config', 'session'])).toEqual({
      config: 'conf.json',
      session: 'spec-abc',
    })
  })

  it('reads params from the hash fragment when present', () => {
    setUrl('/app/#config=conf.json&session=encoded-abc')
    expect(readQueryParams(['config', 'session'])).toEqual({
      config: 'conf.json',
      session: 'encoded-abc',
    })
  })

  it('ignores a plain anchor hash (no "="), falling back to the query string', () => {
    setUrl('/app/?config=conf.json#some-anchor')
    expect(readQueryParams(['config'])).toEqual({ config: 'conf.json' })
  })

  it('setQueryParams writes back to the hash when params live in the hash', () => {
    setUrl('/app/#config=conf.json&session=encoded-long')
    setQueryParams({ session: 'local-123' })

    expect(window.location.hash).toBe('#config=conf.json&session=local-123')
    expect(window.location.search).toBe('')
  })

  it('setQueryParams writes back to the query string for legacy URLs', () => {
    setUrl('/app/?config=conf.json&session=spec-abc')
    setQueryParams({ session: 'local-123' })

    expect(window.location.search).toBe('?config=conf.json&session=local-123')
    expect(window.location.hash).toBe('')
  })

  it('deleteQueryParams strips one-time params but keeps the rest in the hash', () => {
    setUrl('/app/#config=conf.json&session=encoded-x&loc=chr1:1-100')
    deleteQueryParams(['loc'])

    const params = new URLSearchParams(window.location.hash.slice(1))
    expect(params.get('loc')).toBeNull()
    expect(params.get('config')).toBe('conf.json')
    expect(params.get('session')).toBe('encoded-x')
  })
})
