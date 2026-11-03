/**
 * How a dialog's query reaches the BLAT server: the shared jbrowse.org proxy by
 * default, on web and Desktop alike, with the proxy's refusals read as what
 * they mean.
 */
import { DEFAULT_BLAT_URL } from './blatQuery.ts'
import { DEFAULT_ISPCR_URL } from './ispcrQuery.ts'
import { runUcscFetch } from './useUcscQuery.ts'

const PROXY = 'https://api.jbrowse.org/ucsc/v1/blat'
const BODY = 'userSeq=ACGT&db=hg38'

test('the default servers are the shared proxy', () => {
  expect(DEFAULT_BLAT_URL).toBe(PROXY)
  expect(DEFAULT_ISPCR_URL).toBe('https://api.jbrowse.org/ucsc/v1/ispcr')
})

const identity = (text: string) => text

function urlsCalled() {
  return fetchMock.mock.calls.map(call => String(call[0]))
}

beforeEach(() => {
  fetchMock.resetMocks()
})

test('sends the query to the one server and parses the answer', async () => {
  fetchMock.mockResponseOnce('{"ok":1}')
  expect(
    await runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
  ).toBe('{"ok":1}')
  expect(urlsCalled()).toEqual([PROXY])
})

test('says the server must be a proxy when it cannot be reached', async () => {
  fetchMock.mockRejectOnce(new Error('offline'))

  await expect(
    runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
  ).rejects.toThrow(/CORS-enabled proxy/)
})

test('names a relayed UCSC challenge rather than failing generically', async () => {
  fetchMock.mockResponseOnce('<html><div id="cf-chl-widget"></div></html>', {
    status: 403,
  })

  await expect(
    runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
  ).rejects.toThrow(/CAPTCHA challenge/)
})

// a proxy refusal reads as a sentence, not as the JSON envelope it arrived in
test('reports the proxy error message', async () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({ error: 'The shared BLAT budget for today is spent.' }),
    { status: 429 },
  )

  await expect(
    runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
  ).rejects.toThrow(/shared BLAT budget for today is spent/)
})

describe('waiting out the shared key slot', () => {
  function busy(retryAfterSeconds: number): [string, { status: number }] {
    return [
      JSON.stringify({ error: 'one query in flight', retryAfterSeconds }),
      { status: 429 },
    ]
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('waits out a busy slot and retries, saying how long it waits', async () => {
    fetchMock.mockResponses(busy(5), ['{"ok":1}', { status: 200 }])
    const waits: (number | undefined)[] = []

    const result = runUcscFetch({
      urlBase: PROXY,
      body: BODY,
      parse: identity,
      onWait: seconds => {
        waits.push(seconds)
      },
    })
    await jest.advanceTimersByTimeAsync(5000)

    expect(await result).toBe('{"ok":1}')
    expect(waits).toEqual([5, undefined])
    expect(urlsCalled()).toEqual([PROXY, PROXY])
  })

  test('does not wait on a refusal that lasts longer than a slot', async () => {
    fetchMock.mockResponses(busy(3540))

    await expect(
      runUcscFetch({ urlBase: PROXY, body: BODY, parse: identity }),
    ).rejects.toThrow(/one query in flight/)
    expect(urlsCalled()).toEqual([PROXY])
  })

  test('gives up once it has waited two minutes', async () => {
    fetchMock.mockResponse(...busy(30))

    const failure = runUcscFetch({
      urlBase: PROXY,
      body: BODY,
      parse: identity,
    }).catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(120_000)

    expect(String(await failure)).toMatch(/one query in flight/)
    expect(urlsCalled()).toHaveLength(5)
  })

  test('stops waiting when the search is cancelled', async () => {
    fetchMock.mockResponses(busy(10), ['{"ok":1}', { status: 200 }])
    const controller = new AbortController()

    const failure = runUcscFetch({
      urlBase: PROXY,
      body: BODY,
      parse: identity,
      signal: controller.signal,
    }).catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(1000)
    controller.abort()

    expect(String(await failure)).toMatch(/cancelled/)
    expect(urlsCalled()).toEqual([PROXY])
  })
})
