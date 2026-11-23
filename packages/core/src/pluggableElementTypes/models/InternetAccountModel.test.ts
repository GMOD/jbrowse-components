import { types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationReference,
  ConfigurationSchema,
} from '../../configuration/index.ts'
import { InternetAccount } from './InternetAccountModel.ts'
import { BaseInternetAccountConfig } from './baseInternetAccountConfig.ts'
import { credentialBinding } from './credentialBinding.ts'

interface Prompt {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

function makePromptingAccount(extraConf: Record<string, unknown> = {}) {
  const prompts: Prompt[] = []
  const account = InternetAccount.actions(() => ({
    getTokenFromUser(
      resolve: (token: string) => void,
      reject: (error: Error) => void,
    ) {
      prompts.push({ resolve, reject })
    },
  })).create({
    type: 'InternetAccount',
    configuration: {
      type: 'InternetAccount',
      internetAccountId: 'testAccount',
      domains: ['data.example.com'],
      ...extraConf,
    },
  })
  return { account, prompts }
}

beforeEach(() => {
  sessionStorage.clear()
})

test('a prompt that fails after a newer one succeeded leaves the newer token in place', async () => {
  const { account, prompts } = makePromptingAccount()

  const stale = account.getToken()
  await Promise.resolve()
  account.removeToken()
  const fresh = account.getToken()
  await Promise.resolve()
  expect(prompts).toHaveLength(2)

  prompts[1]!.resolve('fresh-token')
  await expect(fresh).resolves.toBe('fresh-token')
  prompts[0]!.reject(new Error('stale prompt dismissed'))
  await expect(stale).rejects.toThrow('stale prompt dismissed')

  expect(account.retrieveToken()).toBe('fresh-token')
  await expect(account.getToken()).resolves.toBe('fresh-token')
  expect(prompts).toHaveLength(2)
})

test('a failed prompt is not kept, so the next read asks again', async () => {
  const { account, prompts } = makePromptingAccount()

  const first = account.getToken()
  await Promise.resolve()
  prompts[0]!.reject(new Error('dismissed'))
  await expect(first).rejects.toThrow('dismissed')

  const second = account.getToken()
  await Promise.resolve()
  expect(prompts).toHaveLength(2)
  prompts[1]!.resolve('token')
  await expect(second).resolves.toBe('token')
})

const ServerAccountConfig = ConfigurationSchema(
  'ServerAccount',
  { baseURL: { type: 'string', defaultValue: '' } },
  { baseConfiguration: BaseInternetAccountConfig, explicitlyTyped: true },
)

function makeServerAccount(baseURL: string) {
  return InternetAccount.named('ServerAccount')
    .props({
      type: types.literal('ServerAccount'),
      configuration: ConfigurationReference(ServerAccountConfig),
    })
    .create({
      type: 'ServerAccount',
      configuration: {
        type: 'ServerAccount',
        internetAccountId: 'testAccount',
        domains: ['data.example.com'],
        baseURL,
      },
    })
}

describe('a stored token is bound to the config of the account that stored it', () => {
  test('an account with the same id but other domains gets no token', () => {
    makePromptingAccount().account.storeToken('secret')

    const { account } = makePromptingAccount({ domains: ['other.example.org'] })

    expect(account.retrieveToken()).toBeUndefined()
  })

  test('an account with the same id but another auth header gets no token', () => {
    makePromptingAccount().account.storeToken('secret')

    const { account } = makePromptingAccount({ authHeader: 'X-Forward-To' })

    expect(account.retrieveToken()).toBeUndefined()
  })

  test('an account with the same id but another custom slot gets no token', () => {
    makeServerAccount('https://server.example.com').storeToken('secret')

    expect(
      makeServerAccount('https://other.example.org').retrieveToken(),
    ).toBeUndefined()
    expect(
      makeServerAccount('https://server.example.com').retrieveToken(),
    ).toBe('secret')
  })

  test('a token stored as a plain string is not read', async () => {
    sessionStorage.setItem('testAccount-token', 'secret')
    const { account, prompts } = makePromptingAccount()

    expect(account.retrieveToken()).toBeUndefined()
    const token = account.getToken()
    await Promise.resolve()
    expect(prompts).toHaveLength(1)
    prompts[0]!.resolve('fresh')
    await expect(token).resolves.toBe('fresh')
  })

  test('an account whose name and description changed keeps the token', () => {
    makePromptingAccount().account.storeToken('secret')

    const { account } = makePromptingAccount({
      name: 'Renamed',
      description: 'Now described',
    })

    expect(account.retrieveToken()).toBe('secret')
  })

  test('the binding does not depend on key order', () => {
    expect(
      credentialBinding({
        type: 'A',
        domains: ['x', 'y'],
        nested: { a: 1, b: [{ c: 1, d: 2 }] },
      }),
    ).toBe(
      credentialBinding({
        nested: { b: [{ d: 2, c: 1 }], a: 1 },
        domains: ['x', 'y'],
        type: 'A',
      }),
    )
  })
})

describe('a pre-authorization token in the location', () => {
  const location = {
    locationType: 'UriLocation' as const,
    uri: 'https://data.example.com/file.bw',
    internetAccountPreAuthorization: {
      internetAccountType: 'InternetAccount',
      authInfo: { token: 'from-location', configuration: {} },
    },
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'WorkerGlobalScope')
  })

  test('is ignored on the main thread', async () => {
    const { account, prompts } = makePromptingAccount()

    const token = account.getToken(location)
    await Promise.resolve()
    expect(prompts).toHaveLength(1)
    prompts[0]!.resolve('typed')

    await expect(token).resolves.toBe('typed')
    await expect(account.getToken()).resolves.toBe('typed')
  })

  test('is used in a worker', async () => {
    Object.defineProperty(globalThis, 'WorkerGlobalScope', {
      value: class {},
      configurable: true,
    })
    const { account, prompts } = makePromptingAccount()

    await expect(account.getToken(location)).resolves.toBe('from-location')
    expect(prompts).toHaveLength(0)
  })
})
