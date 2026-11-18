import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { InternetAccountType } from '@jbrowse/core/pluggableElementTypes'
import {
  BaseInternetAccountConfig,
  InternetAccount,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import { InternetAccountsRootModelMixin } from './InternetAccounts.ts'

import type { UriLocation } from '@jbrowse/core/util'

// Stand-in account types rather than @jbrowse/plugin-authentication, which
// product-core does not depend on. The mixin is what is under test and it reads
// only `internetAccountId`, `handlesLocation` and `type`; the credential
// actually reaching a host is pinned against the real accounts in
// products/jbrowse-web/src/tests/Authentication.test.tsx.
function accountType(name: string) {
  const configSchema = ConfigurationSchema(
    name,
    {},
    { baseConfiguration: BaseInternetAccountConfig, explicitlyTyped: true },
  )
  return new InternetAccountType({
    name,
    configSchema,
    stateModel: InternetAccount.named(name)
      .props({
        type: types.literal(name),
        configuration: ConfigurationReference(configSchema),
      })
      .actions(self => ({
        // the HEAD probe the shipped token-entry accounts run, so the request
        // that carries a credential before the worker sees it exists here too
        async validateToken(token: string, loc: UriLocation) {
          const response = await fetch(
            loc.uri,
            self.addAuthHeaderToInit({ method: 'HEAD' }, token),
          )
          if (!response.ok) {
            throw new Error(`token rejected by ${loc.uri}`)
          }
          return token
        },
      })),
  })
}

// The mixin reads `jbrowse.internetAccounts` through asRoot, so the host model
// supplies that half and the mixin supplies the live `internetAccounts` array.
function makeRoot(...accountConfs: Record<string, unknown>[]) {
  const pluginManager = new PluginManager()
  pluginManager.addInternetAccountType(() => accountType('TestInternetAccount'))
  pluginManager.addInternetAccountType(() =>
    accountType('HTTPBasicInternetAccount'),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const Root = types.compose(
    'Root',
    types.model({
      jbrowse: types.model('JBrowseConfig', {
        internetAccounts: types.array(
          pluginManager.pluggableConfigSchemaType('internet account'),
        ),
      }),
    }),
    InternetAccountsRootModelMixin(pluginManager),
  )
  const root = Root.create({ jbrowse: { internetAccounts: accountConfs } })
  // @ts-expect-error the manager's rootModel is set by the product normally
  pluginManager.rootModel = root
  return root
}

const labAccount = {
  type: 'TestInternetAccount',
  internetAccountId: 'labToken',
  name: 'Lab data portal',
  domains: ['data.mylab.org'],
}

const inScope: UriLocation = {
  locationType: 'UriLocation',
  uri: 'https://data.mylab.org/reads.bam',
  internetAccountId: 'labToken',
}

const outOfScope: UriLocation = {
  locationType: 'UriLocation',
  uri: 'https://evil.example.com/attacker.bam',
  internetAccountId: 'labToken',
}

test('an account named by a location it covers is used', () => {
  const root = makeRoot(labAccount)
  expect(root.findAppropriateInternetAccount(inScope)?.internetAccountId).toBe(
    'labToken',
  )
})

test('naming an account cannot put it outside its domains', () => {
  const root = makeRoot(labAccount)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(root.internetAccounts[0]!.handlesLocation(outOfScope)).toBe(false)
    expect(root.findAppropriateInternetAccount(outOfScope)).toBe(null)
    expect(warn.mock.calls[0]?.[0]).toContain('labToken')
    expect(warn.mock.calls[0]?.[0]).toContain('evil.example.com')
  } finally {
    warn.mockRestore()
  }
})

// The consequence, and the reason the test above is not just about a return
// value: everything downstream of a match sends the credential. `getPreAuth`
// probes the URL with the token attached before the worker ever sees it, so a
// match on an attacker's URL leaks it from the main thread.
test('no request carries the credential to a host outside the domains', async () => {
  const root = makeRoot(labAccount)
  const account = root.internetAccounts[0]!
  account.storeToken('SECRET-LAB-TOKEN')

  const requests: { url: string; auth: string | null }[] = []
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      requests.push({
        url: String(input),
        auth: new Headers(init?.headers).get('Authorization'),
      })
      return new Response('', { status: 200 })
    })

  try {
    // Deliberately not asserting the match is null first — that is the test
    // above, and asserting it here would fail before anything issues a request,
    // leaving the assertion that matters unproven. Take whatever the walk
    // returns all the way to the credential instead.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const claimed = root.findAppropriateInternetAccount(outOfScope)
    await claimed?.getPreAuthorizationInformation(outOfScope).catch(() => {})
    warn.mockRestore()
    expect(requests).toEqual([])

    const matched = root.findAppropriateInternetAccount(inScope)!
    const preauth = await matched.getPreAuthorizationInformation(inScope)
    expect(preauth.authInfo.token).toBe('SECRET-LAB-TOKEN')
    expect(requests.map(r => r.url)).toEqual([
      'https://data.mylab.org/reads.bam',
    ])
    expect(requests[0]!.auth).toBe('SECRET-LAB-TOKEN')
  } finally {
    spy.mockRestore()
  }
})

// A config with relative data paths has no host to put in `domains`, so an
// account it names is honoured for the app's own origin. jsdom serves the
// suite from http://localhost.
test('an account named for a same-origin location is used with no domains', () => {
  const root = makeRoot({
    type: 'TestInternetAccount',
    internetAccountId: 'localToken',
    name: 'Local',
    domains: [],
  })
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'volvox_microarray.bw',
      internetAccountId: 'localToken',
    })?.internetAccountId,
  ).toBe('localToken')
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'http://localhost/volvox_microarray.bw',
      internetAccountId: 'localToken',
    })?.internetAccountId,
  ).toBe('localToken')
})

// The relative form resolves the way the request will. Reading it against the
// page instead would let a spec pass an off-origin base off as local.
test('a relative uri under an off-origin baseUri is not same-origin', () => {
  const root = makeRoot({
    type: 'TestInternetAccount',
    internetAccountId: 'localToken',
    name: 'Local',
    domains: [],
  })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'attacker.bam',
    baseUri: 'https://evil.example.com/',
    internetAccountId: 'localToken',
  })
  warn.mockRestore()
  expect(found).toBe(null)
})

test('an unnamed location still matches on domains', () => {
  const root = makeRoot(labAccount)
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'https://data.mylab.org/reads.bam',
  })
  expect(found?.internetAccountId).toBe('labToken')
})

// The named account losing its claim is not the end of the walk: another
// account whose domains do cover the URL still gets it.
test('a mismatched name falls through to the domains walk', () => {
  const root = makeRoot(labAccount, {
    type: 'TestInternetAccount',
    internetAccountId: 'cdnToken',
    name: 'CDN',
    domains: ['cdn.example.com'],
  })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'https://cdn.example.com/x.bam',
    internetAccountId: 'labToken',
  })
  warn.mockRestore()
  expect(found?.internetAccountId).toBe('cdnToken')
})

// A config asks for a login on its own relative data paths without declaring an
// account by naming an id that leads with an account type.
test('an undeclared typed id is created for a file on the app origin only', () => {
  const root = makeRoot()
  const created = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'volvox_microarray.bw',
    internetAccountId: 'HTTPBasicInternetAccount-HTTPBasicTest',
  })
  expect(created?.type).toBe('HTTPBasicInternetAccount')
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'volvox_microarray.bw',
      internetAccountId: 'HTTPBasicInternetAccount-HTTPBasicTest',
    }),
  ).toBe(created)
  expect(root.internetAccounts.length).toBe(1)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const offOrigin = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'https://evil.example.com/attacker.bam',
    internetAccountId: 'HTTPBasicInternetAccount-HTTPBasicTest',
  })
  warn.mockRestore()
  expect(offOrigin).toBe(null)
  expect(root.internetAccounts.length).toBe(1)
})

// An id naming another origin holds that origin's credential, so a file on the
// app's own origin cannot ask for it.
test('an id naming another origin is not created for a file on the app origin', () => {
  const root = makeRoot()
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'volvox_microarray.bw',
      internetAccountId: 'HTTPBasicInternetAccount-https://data.mylab.org',
    }),
  ).toBe(null)
  expect(root.internetAccounts.length).toBe(0)
})

// jsdom serves the suite from http://localhost: another port or scheme of
// that host is another origin.
test.each(['http://localhost:8080/x.bw', 'https://localhost/x.bw'])(
  'an undeclared typed id is not created for %s',
  uri => {
    const root = makeRoot()
    expect(
      root.findAppropriateInternetAccount({
        locationType: 'UriLocation',
        uri,
        internetAccountId: 'HTTPBasicInternetAccount-HTTPBasicTest',
      }),
    ).toBe(null)
    expect(root.internetAccounts.length).toBe(0)
  },
)

test.each([
  'data:text/plain,x',
  'file:///home/user/x.bam',
  'blob:https://data.mylab.org/0f0f0f0f-0000-4000-8000-000000000000',
])('no account is created for %s, which has no origin of its own', uri => {
  const root = makeRoot()
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri,
      internetAccountId: 'HTTPBasicInternetAccount-https://data.mylab.org',
    }),
  ).toBe(null)
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri,
      internetAccountId: 'HTTPBasicInternetAccount-null',
    }),
  ).toBe(null)
  expect(root.internetAccounts.length).toBe(0)
})

// A location carries a `<TypeName>-<origin>` id when the file selector's
// account picker chose an origin account, or a saved session held one; the
// account is recreated, scoped to that origin.
test('an ephemeral id for a registered type still mints an account', () => {
  const root = makeRoot()
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'https://data.mylab.org/dir/reads.bam',
    internetAccountId: 'HTTPBasicInternetAccount-https://data.mylab.org',
  })
  expect(found?.type).toBe('HTTPBasicInternetAccount')
  expect(found?.domains).toEqual(['https://data.mylab.org/'])
})

const labOrigin = 'HTTPBasicInternetAccount-https://data.mylab.org'

// What RpcManager's 401 retry does: the first file's 401 mints the origin
// account, and every later read of that server reaches it through `domains`,
// since a retried location names no account.
describe('an origin account minted for one file', () => {
  function rootAfterFirst401() {
    const root = makeRoot()
    root.createEphemeralInternetAccount(
      labOrigin,
      {},
      'https://data.mylab.org/a/x.bam',
    )
    return root
  }

  test('answers a file in another directory of that origin', () => {
    const root = rootAfterFirst401()
    expect(
      root.findAppropriateInternetAccount({
        locationType: 'UriLocation',
        uri: 'https://data.mylab.org/b/y.bam',
      }),
    ).toBe(root.internetAccounts[0])
  })

  test.each([
    [
      'a host the origin is a prefix of',
      'https://data.mylab.org.evil.com/x.bam',
    ],
    ['another port', 'https://data.mylab.org:8443/x.bam'],
    ['plain http', 'http://data.mylab.org/x.bam'],
  ])('does not answer %s', (_, uri) => {
    const root = rootAfterFirst401()
    expect(
      root.findAppropriateInternetAccount({ locationType: 'UriLocation', uri }),
    ).toBe(null)
  })
})

test('an existing origin account is not offered to another host', () => {
  const root = makeRoot()
  root.createEphemeralInternetAccount(
    labOrigin,
    {},
    'https://data.mylab.org/dir/reads.bam',
  )
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'https://evil.example.com/attacker.bam',
    internetAccountId: labOrigin,
  })
  warn.mockRestore()
  expect(found).toBe(null)
  expect(root.internetAccounts.length).toBe(1)
})

test('an existing origin account answers for its whole origin', () => {
  const root = makeRoot()
  root.createEphemeralInternetAccount(
    labOrigin,
    {},
    'https://data.mylab.org/dir/reads.bam',
  )
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'https://data.mylab.org/other/more.bam',
    internetAccountId: labOrigin,
  })
  expect(found).toBe(root.internetAccounts[0])
  expect(root.internetAccounts.length).toBe(1)
})

test('an origin account is not created for a location on another host', () => {
  const root = makeRoot()
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'https://evil.example.com/attacker.bam',
      internetAccountId: labOrigin,
    }),
  ).toBe(null)
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'attacker.bam',
      baseUri: 'https://evil.example.com/',
      internetAccountId: labOrigin,
    }),
  ).toBe(null)
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'https://data.mylab.org/reads.bam',
      internetAccountId: 'HTTPBasicInternetAccount-labToken',
    }),
  ).toBe(null)
  expect(root.internetAccounts.length).toBe(0)
})

test('an origin account is created for a relative uri under its own origin', () => {
  const root = makeRoot()
  const found = root.findAppropriateInternetAccount({
    locationType: 'UriLocation',
    uri: 'dir/reads.bam',
    baseUri: 'https://data.mylab.org/',
    internetAccountId: labOrigin,
  })
  expect(found?.internetAccountId).toBe(labOrigin)
  expect(found?.domains).toEqual(['https://data.mylab.org/'])
})

test('an id naming no registered type is ignored', () => {
  const root = makeRoot()
  expect(
    root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'https://data.mylab.org/reads.bam',
      internetAccountId: 'SomeRemovedPluginAccount-https://data.mylab.org',
    }),
  ).toBe(null)
  expect(root.internetAccounts.length).toBe(0)
})

describe.each([
  ['a host the origin is a prefix of', 'https://data.mylab.org.evil.com/x.bam'],
  ['another port', 'https://data.mylab.org:8443/x.bam'],
  ['plain http', 'http://data.mylab.org/x.bam'],
])('an origin account and %s', (_, uri) => {
  const location: UriLocation = {
    locationType: 'UriLocation',
    uri,
    internetAccountId: labOrigin,
  }

  test('is not answered by the existing account', () => {
    const root = makeRoot()
    root.createEphemeralInternetAccount(
      labOrigin,
      {},
      'https://data.mylab.org/dir/reads.bam',
    )
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const found = root.findAppropriateInternetAccount(location)
    warn.mockRestore()
    expect(found).toBe(null)
    expect(root.internetAccounts.length).toBe(1)
  })

  test('does not create one', () => {
    const root = makeRoot()
    expect(root.findAppropriateInternetAccount(location)).toBe(null)
    expect(root.internetAccounts.length).toBe(0)
  })
})

// A configured account keeps to its domains, whatever its id reads like.
describe.each([
  ['TestInternetAccount', 'Other-https://data.mylab.org'],
  ['TestInternetAccount', 'HTTPBasicInternetAccount-https://data.mylab.org'],
  [
    'HTTPBasicInternetAccount',
    'HTTPBasicInternetAccount-https://data.mylab.org',
  ],
])('a configured %s with id %s', (type, internetAccountId) => {
  test('is not used outside its domains on that origin', () => {
    const root = makeRoot({
      type,
      internetAccountId,
      name: 'Public data',
      domains: ['https://data.mylab.org/public/'],
    })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const found = root.findAppropriateInternetAccount({
      locationType: 'UriLocation',
      uri: 'https://data.mylab.org/private/x.bam',
      internetAccountId,
    })
    warn.mockRestore()
    expect(found).toBe(null)
    expect(root.internetAccounts.length).toBe(1)
  })
})
