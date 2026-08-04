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

  it('drops a stale password when switching to a long link', async () => {
    setUrl('/app/?session=share-old&password=stale')
    mockEncode.mockResolvedValue({ sessionParam: 'encoded-BIG' })

    const { url } = await buildShareUrl('long', {}, 'https://share/')
    const u = new URL(url, window.location.origin)
    expect(u.search).toBe('')
    const hashParams = new URLSearchParams(u.hash.slice(1))
    expect(hashParams.get('session')).toBe('encoded-BIG')
    expect(hashParams.get('password')).toBeNull()
  })

  // adminKey survives stripConsumedSessionParams (an admin needs it across
  // reloads), so it is still in the address bar when the share dialog reads it.
  // It is the credential the admin server accepts for rewriting config.json.
  it.each(['short', 'long'] as const)(
    'never carries the admin params into a %s share link',
    async mode => {
      setUrl('/app/?config=conf.json&adminKey=secret&adminServer=/upd')
      mockEncode.mockResolvedValue({
        sessionParam: mode === 'short' ? 'share-abc' : 'encoded-BIG',
      })

      const { url } = await buildShareUrl(mode, {}, 'https://share/')
      expect(url).not.toContain('secret')
      const u = new URL(url, window.location.origin)
      const params = new URLSearchParams(
        mode === 'short' ? u.search : u.hash.slice(1),
      )
      expect(params.get('adminKey')).toBeNull()
      expect(params.get('adminServer')).toBeNull()
      // an ordinary param still comes along
      expect(params.get('config')).toBe('conf.json')
    },
  )

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
