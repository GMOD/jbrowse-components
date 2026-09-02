import { buildShareUrl } from './components/buildShareUrl.ts'
import { createSessionLoaderFromUrl } from './createSessionLoader.ts'

import type { SessionShareMode } from '@jbrowse/core/util'

// The share producer (buildShareUrl -> encodeSessionParam, in core) and the
// share consumer (SessionLoader's prefix dispatch -> fromUrlSafeB64/aesDecrypt,
// in this product) are each well covered, and each covered with the OTHER half
// mocked: buildShareUrl.test.ts mocks encodeSessionParam, SessionLoader.test.ts
// mocks fromUrlSafeB64. So nothing failed when the two disagreed — a renamed
// prefix, a `{session}` wrapper on one side only, a b64 padding change. This
// runs the real loop end to end for all three modes: build a link from a
// snapshot, put that link in the address bar, and let the loader resolve it.
//
// Only the network is stubbed, and only for `short` — the share service is the
// one participant that isn't ours.

jest.mock('./createPluginManager', () => ({
  // async in production (it preloads lazy view state models); a bare jest.fn()
  // returns undefined and buildPluginManager's .then would throw on it
  createPluginManager: jest.fn().mockResolvedValue({}),
}))

jest.mock('idb', () => ({
  openDB: jest.fn(),
}))

// keep the helpers real (stripPrefix and the prefix table are half of what is
// under test); only stub the plugin fetch, which pulls in the whole loader
jest.mock('./sessionLoaderHelpers', () => ({
  ...jest.requireActual('./sessionLoaderHelpers'),
  loadPluginRecords: jest.fn().mockResolvedValue({ records: [], failures: [] }),
}))

const SHARE_URL = 'https://share.example/api/v1/'

const snap = {
  id: 'original-id',
  name: 'a shared session',
  views: [{ id: 'view1', type: 'LinearGenomeView', bpPerPx: 10 }],
  // a value that has to survive percent-encoding in a URL param
  sessionTracks: [{ trackId: 't&1', name: 'has #hash and ?query' }],
}

function field(body: unknown, name: string) {
  if (!(body instanceof FormData)) {
    throw new Error('share upload did not send a FormData body')
  }
  const value = body.get(name)
  if (typeof value !== 'string') {
    throw new Error(`share upload has no "${name}" field`)
  }
  return value
}

// Stands in for the share lambda: remembers what `share` uploaded and hands it
// back to `load`, so the encrypt and decrypt halves meet the way they do in
// production rather than through a canned fixture.
function mockShareService() {
  const state: { uploaded?: string; referer?: string } = {}
  const realFetch = global.fetch
  global.fetch = async (input, init) => {
    const url = String(input)
    if (url === `${SHARE_URL}share`) {
      state.uploaded = field(init?.body, 'session')
      state.referer = field(init?.body, 'referer')
      return new Response(JSON.stringify({ sessionId: 'sessId1' }))
    } else if (url === `${SHARE_URL}load?sessionId=sessId1`) {
      return new Response(JSON.stringify({ session: state.uploaded }))
    }
    throw new Error(`unexpected request to ${url}`)
  }
  return {
    state,
    restore: () => {
      global.fetch = realFetch
    },
  }
}

// Builds a link for `mode`, navigates to it, and resolves it the way a fresh
// page load would.
async function roundTrip(mode: SessionShareMode) {
  window.history.replaceState(null, '', '/app/?config=conf.json')
  const { url } = await buildShareUrl(mode, snap, SHARE_URL)

  window.history.replaceState(null, '', url)
  const loader = createSessionLoaderFromUrl(Date.now())
  // what fetchConfig would have committed; fetchSharedSession reads the share
  // service's location back out of it
  await loader.loadConfigAndPlugins({ configuration: { shareURL: SHARE_URL } })
  await loader.loadSessionByType()
  return { loader, url }
}

test.each(['short', 'long', 'json'] as const)(
  'a session survives a %s share link',
  async mode => {
    const service = mockShareService()
    try {
      const { loader } = await roundTrip(mode)

      const source = loader.sessionSource
      if (source?.type !== 'snapshot') {
        throw new Error(`expected a snapshot, resolved to ${source?.type}`)
      }
      // the id is deliberately not preserved: an imported session forks a fresh
      // local id so two tabs opening the same link don't autosave over one
      // another
      expect(source.snapshot).toEqual({ ...snap, id: expect.any(String) })
      expect(source.snapshot.id).not.toBe(snap.id)
    } finally {
      service.restore()
    }
  },
)

test('a short link uploads an encrypted session, not the session', async () => {
  const service = mockShareService()
  try {
    await roundTrip('short')

    // the crypto-js OpenSSL envelope ("Salted__" + salt, base64) the deployed
    // lambda stores and every already-shared link decodes from
    expect(service.state.uploaded).toMatch(/^U2FsdGVkX1/)
    expect(service.state.uploaded).not.toContain('a shared session')
    // and the page it was shared from is reported, since that is what the
    // referer field is for
    expect(service.state.referer).toContain('config=conf.json')
  } finally {
    service.restore()
  }
})

test('the inline modes need no share service at all', async () => {
  const service = mockShareService()
  try {
    // any request would throw out of the stub above
    const { url } = await roundTrip('long')
    // ...and they ride in the hash, where a length no server has to accept
    // can't become an HTTP 414
    expect(new URL(url).search).toBe('')
    expect(new URL(url).hash).toContain('session=encoded-')
  } finally {
    service.restore()
  }
})
