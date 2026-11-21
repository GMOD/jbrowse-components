import { InternetAccount } from './InternetAccountModel.ts'

interface Prompt {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

function makePromptingAccount() {
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

  expect(sessionStorage.getItem('testAccount-token')).toBe('fresh-token')
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
