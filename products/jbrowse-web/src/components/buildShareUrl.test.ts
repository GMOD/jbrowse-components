import { encodeSessionParam } from '@jbrowse/core/util'

import { buildShareUrl } from './buildShareUrl.ts'

jest.mock('@jbrowse/core/util', () => ({
  encodeSessionParam: jest.fn(),
}))

const mockEncode = encodeSessionParam as jest.Mock

const PAGE = 'http://localhost/app/'

async function build(mode: 'short' | 'long', page: string) {
  const url = await buildShareUrl(mode, {}, 'https://share/', PAGE + page)
  const u = new URL(url)
  return { url, u, params: new URLSearchParams(u.hash.slice(1)) }
}

const referer = () => mockEncode.mock.calls.at(-1)![2].referer as string

describe('buildShareUrl', () => {
  it('puts a long (encoded) session in the hash, keeping config', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'encoded-BIG' })

    const { u, params } = await build(
      'long',
      '?config=conf.json&session=local-old',
    )
    expect(u.search).toBe('')
    expect(params.get('config')).toBe('conf.json')
    expect(params.getAll('session')).toEqual(['encoded-BIG'])
  })

  // the password decrypts the uploaded session, and a query string reaches the
  // access log of whatever serves the page
  it('puts a short link and its password in the hash', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'share-abc', password: 'pw' })

    const { u, params } = await build('short', '?config=conf.json')
    expect(u.search).toBe('')
    expect(params.get('session')).toBe('share-abc')
    expect(params.get('password')).toBe('pw')
    expect(params.get('config')).toBe('conf.json')
  })

  it('drops a stale password when switching to a long link', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'encoded-BIG' })

    const { params } = await build('long', '#session=share-old&password=stale')
    expect(params.get('session')).toBe('encoded-BIG')
    expect(params.get('password')).toBeNull()
  })

  // adminKey survives stripConsumedSessionParams (an admin needs it across
  // reloads), so it is still in the address bar when the share dialog reads it.
  // It is the credential the admin server accepts for rewriting config.json.
  it.each(['short', 'long'] as const)(
    'never carries the admin params into a %s share link',
    async mode => {
      mockEncode.mockResolvedValue({
        sessionParam: mode === 'short' ? 'share-abc' : 'encoded-BIG',
      })

      const { url, params } = await build(
        mode,
        '?config=conf.json&adminKey=secret&adminServer=/upd',
      )
      expect(url).not.toContain('secret')
      expect(params.get('adminServer')).toBeNull()
      expect(params.get('config')).toBe('conf.json')
    },
  )

  // safeMode is this browser's escape hatch from a crashing permanent plugin,
  // and it sticks across reloads on purpose — carried into a link it would
  // silently switch off the recipient's own plugins
  it('does not carry safeMode into the link', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'share-abc', password: 'pw' })

    const { url } = await build('short', '?config=conf.json&safeMode=1')
    expect(url).toContain('config=conf.json')
    expect(url).not.toContain('safeMode')
  })

  // The referer is POSTed to the share server and stored beside the session, so
  // it has to drop everything the shared link itself drops.
  it('never reports the admin params or a password as the referer', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'share-abc', password: 'pw' })

    await build(
      'short',
      '?config=conf.json&adminKey=secret&adminServer=/upd&password=x',
    )
    expect(referer()).toContain('config=conf.json')
    expect(referer()).not.toContain('secret')
    expect(referer()).not.toContain('adminServer')
    expect(referer()).not.toContain('password')
  })

  // uploading an inline session in the referer field would hand the share
  // service the very session short mode encrypts
  it('reports a hash page by its params, without its session', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'share-abc', password: 'pw' })

    await build(
      'short',
      '#config=conf.json&adminKey=secret&session=encoded-BIG',
    )
    expect(referer()).toBe(`${PAGE}?config=conf.json`)
  })

  it('carries existing hash params when the page already uses the hash', async () => {
    mockEncode.mockResolvedValue({ sessionParam: 'encoded-BIG' })

    const { u, params } = await build(
      'long',
      '#config=conf.json&session=local-old',
    )
    expect(u.search).toBe('')
    expect(params.get('session')).toBe('encoded-BIG')
    expect(params.get('config')).toBe('conf.json')
  })
})
