import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

function makeAccount(validateWithHEAD = true) {
  return stateModelFactory(configSchema).create({
    type: 'HTTPBasicInternetAccount',
    // a snapshot, not configSchema.create: ConfigurationReference stores an
    // instance by identifier, which nothing in this bare tree can resolve
    configuration: {
      type: 'HTTPBasicInternetAccount',
      internetAccountId: 'testBasic',
      domains: ['data.example.com'],
      validateWithHEAD,
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
  fetchMock = jest.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

test('a stored credential is sent as a Basic header and not re-proven per request', async () => {
  sessionStorage.setItem('testBasic-token', 'dXNlcjpwdw==')
  fetchMock.mockResolvedValue(new Response('data'))
  const fetcher = makeAccount().getFetcher(location)

  await fetcher(location.uri)
  await fetcher(location.uri)

  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(
    new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization'),
  ).toBe('Basic dXNlcjpwdw==')
})

// The same latch the OAuth accounts had: nothing can renew a password but the
// user, so a credential the server rejects has to leave the cache or the dialog
// is never reopened and every later read throws the identical error.
test('a credential the server rejects is dropped, so the next read can prompt again', async () => {
  sessionStorage.setItem('testBasic-token', 'd3Jvbmc=')
  fetchMock.mockResolvedValue(new Response('nope', { status: 401 }))

  await expect(
    makeAccount().getFetcher(location)(location.uri),
  ).rejects.toThrow('HTTP 401 - Error validating token - nope')

  // the read, then validateToken's HEAD confirming the credential is the problem
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(sessionStorage.getItem('testBasic-token')).toBeNull()
})

// validateToken hands the same credential straight back when the HEAD check is
// off, and re-running the request with a token that just failed only buys a
// second identical 401
test('with validateWithHEAD off a 401 comes back as-is, with no extra request', async () => {
  sessionStorage.setItem('testBasic-token', 'd3Jvbmc=')
  fetchMock.mockResolvedValue(new Response('nope', { status: 401 }))

  const response = await makeAccount(false).getFetcher(location)(location.uri)

  expect(response.status).toBe(401)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
