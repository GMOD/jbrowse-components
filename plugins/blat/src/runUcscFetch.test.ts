/**
 * The desktop fallback policy. The dialog defaults to the shared jbrowse.org
 * proxy so BLAT works with no apiKey and no CAPTCHA, and desktop — which can
 * reach UCSC itself — retries there when the proxy cannot serve the query. What
 * makes that safe is the "cannot serve" test: retrying a query UCSC would also
 * refuse just spends the CAPTCHA-solving user's patience twice.
 */
import { BlatChallengeError } from './blatQuery.ts'
import { runUcscFetch } from './useUcscQuery.ts'

const PROXY = 'https://api.jbrowse.org/ucsc/v1/blat'
const DIRECT = 'https://genome.ucsc.edu/cgi-bin/hgBlat'
const BODY = 'userSeq=ACGT&db=hg38'

const identity = (text: string) => text

function urlsCalled() {
  return fetchMock.mock.calls.map(call => String(call[0]))
}

beforeEach(() => {
  fetchMock.resetMocks()
})

test('goes to the one server when there is nothing to fall back to', async () => {
  fetchMock.mockResponseOnce('{"ok":1}')
  expect(
    await runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
  ).toBe('{"ok":1}')
  expect(urlsCalled()).toEqual([PROXY])
})

test('retries UCSC directly when the shared budget is spent', async () => {
  fetchMock.mockResponses(
    [JSON.stringify({ error: 'budget spent' }), { status: 429 }],
    ['{"ok":1}', { status: 200 }],
  )

  const result = await runUcscFetch({
    urlBase: PROXY,
    fallbackUrl: DIRECT,
    body: BODY,
    parse: identity,
  })

  expect(result).toBe('{"ok":1}')
  expect(urlsCalled()).toEqual([PROXY, DIRECT])
})

test('retries when the proxy is broken', async () => {
  fetchMock.mockResponses(
    ['boom', { status: 502 }],
    ['{"ok":1}', { status: 200 }],
  )
  await runUcscFetch({
    urlBase: PROXY,
    fallbackUrl: DIRECT,
    body: BODY,
    parse: identity,
  })
  expect(urlsCalled()).toEqual([PROXY, DIRECT])
})

test('retries when the proxy cannot be reached at all', async () => {
  fetchMock.mockRejectOnce(new Error('offline'))
  fetchMock.mockResponseOnce('{"ok":1}')

  const result = await runUcscFetch({
    urlBase: PROXY,
    fallbackUrl: DIRECT,
    body: BODY,
    parse: identity,
  })

  expect(result).toBe('{"ok":1}')
  expect(urlsCalled()).toEqual([PROXY, DIRECT])
})

// the query is malformed or the assembly unknown; UCSC would refuse it too
test('does not retry a rejection the direct server would repeat', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ error: 'missing userSeq' }), {
    status: 400,
  })

  await expect(
    runUcscFetch({
      urlBase: PROXY,
      fallbackUrl: DIRECT,
      body: BODY,
      parse: identity,
    }),
  ).rejects.toThrow(/missing userSeq/)
  expect(urlsCalled()).toEqual([PROXY])
})

// falling back is what exposes desktop to the CAPTCHA the proxy exists to avoid,
// so the challenge has to survive the second hop as a challenge — that is what
// puts the solve-it affordance on screen
test('surfaces a challenge met on the fallback as a challenge', async () => {
  fetchMock.mockResponses(
    ['{"error":"spent"}', { status: 429 }],
    ['<html><div id="cf-chl-widget"></div></html>', { status: 403 }],
  )

  await expect(
    runUcscFetch({
      urlBase: PROXY,
      fallbackUrl: DIRECT,
      body: BODY,
      parse: identity,
    }),
  ).rejects.toThrow(BlatChallengeError)
})

// a proxy refusal that is not retried still reads as a sentence, not as the
// JSON envelope it arrived in
test('reports the proxy error message when there is no fallback', async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ error: 'The shared BLAT budget for today is spent.' }),
    { status: 429 },
  )

  await expect(
    runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
  ).rejects.toThrow(/shared BLAT budget for today is spent/)
})
