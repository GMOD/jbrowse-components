import { InternetAccount } from '../../pluggableElementTypes/models/InternetAccountModel.ts'
import { getFetcher } from './index.ts'

import type PluginManager from '../../PluginManager.ts'
import type { UriLocation } from '../types/data.ts'

// A real account, so the scope test under `getFetcher` is the real
// `handlesLocation`/`uriMatchesDomains` rather than a copy of it, and a real
// token so what each url does or does not carry is the credential itself.
function pluginManagerFor(domains: string[]) {
  const account = InternetAccount.create({
    type: 'InternetAccount',
    configuration: {
      type: 'InternetAccount',
      internetAccountId: 'testAccount',
      domains,
    },
  })
  return {
    rootModel: {
      internetAccounts: [account],
      findAppropriateInternetAccount: () => account,
    },
  } as unknown as PluginManager
}

function locationFor(uri: string): UriLocation {
  return {
    uri,
    locationType: 'UriLocation',
    internetAccountPreAuthorization: {
      internetAccountType: 'InternetAccount',
      authInfo: { token: 'SECRET', configuration: {} },
    },
  }
}

const sent = jest.fn<Promise<Response>, [RequestInfo, RequestInit?]>()

beforeEach(() => {
  sent.mockReset()
  sent.mockResolvedValue(new Response())
  globalThis.fetch = sent as unknown as typeof fetch
})

function credentialSent() {
  const init = sent.mock.calls.at(-1)?.[1]
  return new Headers(init?.headers).get('Authorization')
}

const PRIVATE = ['data.mylab.org/private']
const BASE = 'https://data.mylab.org/private/reads'

test('the url the fetcher was requested for carries the credential', async () => {
  const fetcher = getFetcher(locationFor(BASE), pluginManagerFor(PRIVATE))

  await fetcher(BASE)

  expect(credentialSent()).toBe('SECRET')
})

// The ticket names where the blocks live, and a server can put them on any host
// it likes — including one this account has no business authenticating.
test('a block on an unrelated origin is fetched without the credential', async () => {
  const fetcher = getFetcher(locationFor(BASE), pluginManagerFor(PRIVATE))

  await fetcher('https://blocks.cdn.example.net/chunk/0')

  expect(credentialSent()).toBeNull()
})

// The case an origin comparison gets wrong in the permissive direction. A
// `domains` entry containing a `/` scopes to a path — the authentication docs
// recommend exactly this pair of accounts, and it is the shape every ephemeral
// HTTP Basic account is minted with (origin plus the file's directory).
test('a block on the same origin but outside the account path is fetched without the credential', async () => {
  const fetcher = getFetcher(locationFor(BASE), pluginManagerFor(PRIVATE))

  await fetcher('https://data.mylab.org/public/upload/attacker.bam')

  expect(credentialSent()).toBeNull()
})

// @gmod/bam builds the ticket url as `${baseUrl}/${trackId}?...` with no
// encoding, and jbrowse-web takes track configs from `sessionTracks` in the url,
// so the trackId is attacker-supplied in a share link. Traversal keeps the
// origin and leaves the account's path.
test('a trackId traversing out of the account path does not carry the credential', async () => {
  const fetcher = getFetcher(locationFor(BASE), pluginManagerFor(PRIVATE))

  await fetcher(`${BASE}/../../public/upload/attacker?class=header&format=BAM`)

  expect(credentialSent()).toBeNull()
})

// The case an origin comparison gets wrong in the other direction: one account
// routinely spans several hosts, and a block on a sibling host it declares is
// in scope. Dropbox ships seven domains by default for this reason.
test('a block on a sibling host the account declares carries the credential', async () => {
  const fetcher = getFetcher(
    locationFor('https://dropbox.com/htsget/reads'),
    pluginManagerFor(['dropbox.com', 'dropboxapi.com']),
  )

  await fetcher('https://content.dropboxapi.com/2/files/chunk0')

  expect(credentialSent()).toBe('SECRET')
})

// Out of scope means a plain fetch, not `checkAuthNeededFetch`: a 401 from a url
// the config never named must not raise an HTTP Basic prompt for a host the
// server picked.
test('a 401 from an out-of-scope block raises no auth prompt', async () => {
  const fetcher = getFetcher(locationFor(BASE), pluginManagerFor(PRIVATE))
  sent.mockResolvedValue(
    new Response('', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="x"' },
    }),
  )

  await expect(
    fetcher('https://blocks.cdn.example.net/chunk/0'),
  ).resolves.toMatchObject({ status: 401 })
})

// With no account there is no scope to enforce and no credential to leak, so
// this path is unchanged — a 401 still raises the prompt that mints one.
test('with no matching account a 401 still raises the auth prompt', async () => {
  const fetcher = getFetcher({ uri: BASE, locationType: 'UriLocation' })
  sent.mockResolvedValue(
    new Response('', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="x"' },
    }),
  )

  await expect(fetcher(BASE)).rejects.toThrow(/without authentication/)
})
