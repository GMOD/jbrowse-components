import { sha256Base64Url } from '@jbrowse/core/util'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

function makeAccount(extraConf: Record<string, unknown> = {}) {
  return stateModelFactory(configSchema).create({
    type: 'OAuthInternetAccount',
    // a snapshot, not configSchema.create: ConfigurationReference stores an
    // instance by identifier, which nothing in this bare tree can resolve
    configuration: {
      type: 'OAuthInternetAccount',
      internetAccountId: 'testOAuth',
      clientId: 'test-client',
      authEndpoint: 'https://provider.example.com/authorize',
      tokenEndpoint: 'https://provider.example.com/token',
      domains: ['data.example.com'],
      ...extraConf,
    },
  })
}

const location = {
  locationType: 'UriLocation' as const,
  uri: 'https://data.example.com/file.bw',
}

let fetchMock: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  fetchMock = jest.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

test('a working token is not re-proven on every request', async () => {
  sessionStorage.setItem('testOAuth-token', 'good-token')
  fetchMock.mockResolvedValue(new Response('data'))
  const fetcher = makeAccount().getFetcher(location)

  for (let i = 0; i < 3; i++) {
    await fetcher(location.uri)
  }

  // three reads, three requests — no validation round trip in between
  expect(fetchMock).toHaveBeenCalledTimes(3)
  for (const [, init] of fetchMock.mock.calls) {
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer good-token',
    )
  }
})

test('a 401 refreshes the token once and retries the request', async () => {
  sessionStorage.setItem('testOAuth-token', 'expired-token')
  localStorage.setItem('testOAuth-refreshToken', 'refresh-token')
  fetchMock
    // the read, with the expired token
    .mockResolvedValueOnce(new Response('', { status: 401 }))
    // validateToken's HEAD of the resource, also unauthorized
    .mockResolvedValueOnce(new Response('', { status: 401 }))
    // the refresh exchange
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'fresh-token' })),
    )
    // the HEAD again, proving the refreshed token before it is handed back
    .mockResolvedValueOnce(new Response(''))
    // the retried read
    .mockResolvedValueOnce(new Response('data'))

  const account = makeAccount()
  const response = await account.getFetcher(location)(location.uri)

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('data')
  expect(
    new Headers(fetchMock.mock.calls[4]?.[1]?.headers).get('Authorization'),
  ).toBe('Bearer fresh-token')
  // the refreshed token replaces the cached one, so the next read does not
  // repeat the whole validate-and-refresh round trip
  expect(sessionStorage.getItem('testOAuth-token')).toBe('fresh-token')

  fetchMock.mockResolvedValue(new Response('more data'))
  await account.getFetcher(location)(location.uri)
  expect(fetchMock).toHaveBeenCalledTimes(6)
})

test('the authorization request carries a generated state and no provider-specific params', async () => {
  const opened: URL[] = []
  window.open = jest.fn(url => {
    opened.push(new URL(String(url)))
    return {} as Window
  })

  const promise = makeAccount().getTokenViaAuthFlow()
  await Promise.resolve()

  const url = opened[0]!
  const state = url.searchParams.get('state')
  // the config leaves `state` empty, so the flow mints a nonce rather than
  // shipping the redirect's CSRF check turned off
  expect(state).toMatch(/^[\w-]{16,}$/)
  // token_access_type is Dropbox's spelling of offline access and lives on the
  // Dropbox account now, not on every OAuth request
  expect(url.searchParams.has('token_access_type')).toBe(false)

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        name: 'JBrowseAuthWindow-testOAuth',
        redirectUri: `http://localhost/#access_token=granted&state=${state}`,
      },
    }),
  )
  expect(await promise).toBe('granted')
})

test('a blocked popup fails the flow instead of hanging', async () => {
  window.open = jest.fn(() => null)
  await expect(makeAccount().getTokenViaAuthFlow()).rejects.toThrow(
    'Could not open the testOAuth login window',
  )
})

test('a 401 with no refresh token surfaces the validation error', async () => {
  sessionStorage.setItem('testOAuth-token', 'expired-token')
  fetchMock.mockResolvedValue(new Response('nope', { status: 401 }))

  await expect(
    makeAccount().getFetcher(location)(location.uri),
  ).rejects.toThrow('HTTP 401 - Error validating token - nope')
})

// An account with no refresh token to fall back on — which is every account
// using the implicit flow, Google Drive included — used to keep the dead token
// cached, so it threw the same error on every later request and never asked the
// user to log in again
test('a token that fails validation is dropped, so the next read re-prompts', async () => {
  sessionStorage.setItem('testOAuth-token', 'expired-token')
  fetchMock.mockResolvedValue(new Response('nope', { status: 401 }))

  const account = makeAccount()
  await expect(account.getFetcher(location)(location.uri)).rejects.toThrow()

  expect(sessionStorage.getItem('testOAuth-token')).toBeNull()
  // and the in-memory cache went with it: the next read starts a fresh auth
  // flow rather than replaying the token that just failed
  const opened: string[] = []
  window.open = jest.fn(url => {
    opened.push(String(url))
    return {} as Window
  })
  const reprompted = account.getFetcher(location)(location.uri)
  await Promise.resolve()
  await Promise.resolve()
  expect(opened).toHaveLength(1)

  // and settle it: an abandoned flow keeps a live message listener on `window`
  // for this same account id, which then answers the message a later test
  // dispatches and rejects on the state mismatch, with nothing awaiting it
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        name: 'JBrowseAuthWindow-testOAuth',
        redirectUri: `${window.location.origin}/?error=access_denied&state=${new URL(
          opened[0]!,
        ).searchParams.get('state')}`,
      },
    }),
  )
  await expect(reprompted).rejects.toThrow('OAuth flow was cancelled')
})

// Runs one authorization-code flow and reports the challenge the auth window
// was opened with alongside the verifier the exchange sent back.
async function runAuthFlow(
  account: ReturnType<typeof makeAccount>,
  code: string,
) {
  let authUrl = ''
  window.open = jest.fn(url => {
    authUrl = String(url)
    return { closed: false, close: () => {} } as Window
  })
  // a fresh Response per call: a body can only be read once
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ access_token: `token-for-${code}` })),
  )
  const flow = account.getTokenViaAuthFlow()
  // polled rather than ticked a fixed number of times: computing the challenge
  // is a real WebCrypto digest, so the window opens some way into the flow
  for (let i = 0; i < 100 && !authUrl; i++) {
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  }
  expect(authUrl).toContain('code_challenge')
  const state = new URL(authUrl).searchParams.get('state')
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        name: 'JBrowseAuthWindow-testOAuth',
        redirectUri: `${window.location.origin}/?code=${code}&state=${state}`,
      },
    }),
  )
  await flow
  const [, init] = fetchMock.mock.calls.at(-1)!
  return {
    challenge: new URL(authUrl).searchParams.get('code_challenge'),
    verifier: new URLSearchParams(String(init?.body)).get('code_verifier'),
  }
}

test('each authorization request gets its own PKCE verifier', async () => {
  const account = makeAccount({ needsPKCE: true })

  const first = await runAuthFlow(account, 'code-one')
  account.removeToken()
  const second = await runAuthFlow(account, 'code-two')

  // rotation is only half of it — the verifier the exchange sends has to be
  // the preimage of the challenge that opened the same flow, or the provider
  // rejects every exchange and rotating twice looks identical from here
  expect(await sha256Base64Url(first.verifier!)).toBe(first.challenge)
  expect(await sha256Base64Url(second.verifier!)).toBe(second.challenge)
  // and a second flow reuses neither half of the first
  expect(second.verifier).not.toBe(first.verifier)
  expect(second.challenge).not.toBe(first.challenge)
})
