import configSchema from './configSchema.ts'
import stateModelFactory from './model.tsx'

function makeAccount() {
  return stateModelFactory(configSchema).create({
    type: 'GoogleDriveOAuthInternetAccount',
    // a snapshot, not configSchema.create: ConfigurationReference stores an
    // instance by identifier, which nothing in this bare tree can resolve
    configuration: {
      type: 'GoogleDriveOAuthInternetAccount',
      internetAccountId: 'testGoogleDrive',
      clientId: 'test-client',
    },
  })
}

const location = {
  locationType: 'UriLocation' as const,
  uri: 'https://drive.google.com/file/d/1234567890abcdefghijklmno/view',
}

let fetchMock: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  fetchMock = jest.fn()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

// Google Drive defaults to the implicit flow, which issues no refresh token at
// all, and its access tokens last an hour. Leaving the expired one cached meant
// every read for the rest of the session threw this same error, with nothing
// ever prompting for a new login.
test('an expired token is dropped rather than left cached', async () => {
  sessionStorage.setItem('testGoogleDrive-token', 'expired-token')
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({ error: { message: 'Invalid Credentials' } }),
      {
        status: 401,
      },
    ),
  )

  const account = makeAccount()
  await expect(account.getFetcher(location)(location.uri)).rejects.toThrow(
    'Invalid Credentials',
  )

  expect(sessionStorage.getItem('testGoogleDrive-token')).toBeNull()

  // and getToken's in-memory promise went with it, so the next read opens a
  // login window instead of replaying the token that just failed
  const opened: string[] = []
  window.open = jest.fn(url => {
    opened.push(String(url))
    return {} as Window
  })
  void account
    .getFetcher(location)(location.uri)
    .catch(() => {})
  await Promise.resolve()
  await Promise.resolve()
  expect(opened).toHaveLength(1)
})
