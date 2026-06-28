import { encodeSessionParam } from '@jbrowse/core/util'

import { buildShareUrl } from './buildShareUrl.ts'

// jest.mock is hoisted above the imports by babel-jest regardless of position
jest.mock('@jbrowse/core/util', () => ({
  encodeSessionParam: jest.fn(),
}))

const mockEncode = encodeSessionParam as jest.Mock

function setUrl(url: string) {
  window.history.replaceState(null, '', url)
}

describe('buildShareUrl', () => {
  it('puts a long (encoded) session in the hash, keeping config', async () => {
    setUrl('/app/?config=conf.json&session=local-old')
    mockEncode.mockResolvedValue({ sessionParam: 'encoded-BIG' })

    const { url } = await buildShareUrl('long', {}, 'https://share/')
    const u = new URL(url, window.location.origin)
    expect(u.search).toBe('')
    const hashParams = new URLSearchParams(u.hash.slice(1))
    expect(hashParams.get('session')).toBe('encoded-BIG')
    expect(hashParams.get('config')).toBe('conf.json')
    // the stale local session id is overwritten, not duplicated
    expect(hashParams.getAll('session')).toEqual(['encoded-BIG'])
  })

  it('puts a json session in the hash', async () => {
    setUrl('/app/?config=conf.json')
    mockEncode.mockResolvedValue({
      sessionParam: 'json-{"session":{}}',
      plaintext: '{}',
    })

    const { url } = await buildShareUrl('json', {}, 'https://share/')
    const u = new URL(url, window.location.origin)
    expect(u.search).toBe('')
    expect(new URLSearchParams(u.hash.slice(1)).get('session')).toBe(
      'json-{"session":{}}',
    )
  })

  it('keeps a short share link (and its password) in the query string', async () => {
    setUrl('/app/?config=conf.json')
    mockEncode.mockResolvedValue({ sessionParam: 'share-abc', password: 'pw' })

    const { url, passwordParam } = await buildShareUrl(
      'short',
      {},
      'https://share/',
    )
    const u = new URL(url, window.location.origin)
    expect(u.hash).toBe('')
    const params = new URLSearchParams(u.search)
    expect(params.get('session')).toBe('share-abc')
    expect(params.get('password')).toBe('pw')
    expect(params.get('config')).toBe('conf.json')
    expect(passwordParam).toBe('pw')
  })

  it('carries existing hash params when the page already uses the hash', async () => {
    setUrl('/app/#config=conf.json&session=local-old')
    mockEncode.mockResolvedValue({ sessionParam: 'encoded-BIG' })

    const { url } = await buildShareUrl('long', {}, 'https://share/')
    const u = new URL(url, window.location.origin)
    expect(u.search).toBe('')
    const hashParams = new URLSearchParams(u.hash.slice(1))
    expect(hashParams.get('session')).toBe('encoded-BIG')
    expect(hashParams.get('config')).toBe('conf.json')
  })
})
