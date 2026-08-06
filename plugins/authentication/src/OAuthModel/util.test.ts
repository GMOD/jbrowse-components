import {
  finishOAuthRedirect,
  finishOAuthWindow,
  waitForOAuthMessage,
} from './util.ts'

import type { OAuthWindowParams } from './util.ts'

function makeParams(overrides?: Partial<OAuthWindowParams>): OAuthWindowParams {
  return {
    internetAccountId: 'testAccount',
    expectedState: undefined,
    exchangeAuthorizationCode: async () => 'exchanged-token',
    storeToken: () => {},
    ...overrides,
  }
}

function makeEvent(data: unknown, origin = window.location.origin) {
  return new MessageEvent('message', { data, origin })
}

function makeRedirectEvent(redirectUri: string) {
  return makeEvent({ name: 'JBrowseAuthWindow-testAccount', redirectUri })
}

describe('finishOAuthRedirect', () => {
  it('returns access_token from implicit flow (hash fragment)', async () => {
    const stored: string[] = []
    const token = await finishOAuthRedirect(
      'http://localhost/auth#access_token=my-token&token_type=bearer',
      makeParams({
        storeToken: t => {
          stored.push(t)
        },
      }),
    )
    expect(token).toBe('my-token')
    expect(stored).toEqual(['my-token'])
  })

  it('exchanges code and returns token from authorization code flow', async () => {
    const stored: string[] = []
    const token = await finishOAuthRedirect(
      'http://localhost/auth?code=auth-code',
      makeParams({
        exchangeAuthorizationCode: async (code, redirectUri) => {
          expect(code).toBe('auth-code')
          expect(redirectUri).toBe('http://localhost/auth')
          return 'code-exchanged-token'
        },
        storeToken: t => {
          stored.push(t)
        },
      }),
    )
    expect(token).toBe('code-exchanged-token')
    expect(stored).toEqual(['code-exchanged-token'])
  })

  it('throws on state mismatch', async () => {
    await expect(
      finishOAuthRedirect(
        'http://localhost/auth?code=abc&state=wrong',
        makeParams({ expectedState: 'expected' }),
      ),
    ).rejects.toThrow('OAuth state mismatch')
  })

  it('passes state check when state matches', async () => {
    const token = await finishOAuthRedirect(
      'http://localhost/auth?code=abc&state=correct',
      makeParams({ expectedState: 'correct' }),
    )
    expect(token).toBe('exchanged-token')
  })

  it('throws "OAuth flow was cancelled" for access_denied error', async () => {
    await expect(
      finishOAuthRedirect(
        'http://localhost/auth?error=access_denied',
        makeParams(),
      ),
    ).rejects.toThrow('OAuth flow was cancelled')
  })

  it('throws "OAuth flow error: X" for other errors', async () => {
    await expect(
      finishOAuthRedirect(
        'http://localhost/auth?error=server_error',
        makeParams(),
      ),
    ).rejects.toThrow('OAuth flow error: server_error')
  })

  it('returns undefined when redirect has no token, code, or error', async () => {
    expect(
      await finishOAuthRedirect('http://localhost/auth', makeParams()),
    ).toBeUndefined()
  })
})

describe('finishOAuthWindow', () => {
  it('completes the flow for this account', async () => {
    const event = makeRedirectEvent('http://localhost/auth?code=auth-code')
    expect(await finishOAuthWindow(event, makeParams())).toBe('exchanged-token')
  })

  it('returns undefined when event name does not match', async () => {
    const event = makeEvent({
      name: 'JBrowseAuthWindow-otherAccount',
      redirectUri: 'http://x/?code=abc',
    })
    expect(await finishOAuthWindow(event, makeParams())).toBeUndefined()
  })

  it('ignores a message from another origin', async () => {
    const event = makeEvent(
      {
        name: 'JBrowseAuthWindow-testAccount',
        redirectUri: 'http://localhost/auth#access_token=injected',
      },
      'https://evil.example.com',
    )
    expect(await finishOAuthWindow(event, makeParams())).toBeUndefined()
  })

  it('ignores messages whose data is not an object', async () => {
    for (const data of [null, undefined, 'a string', 42]) {
      expect(
        await finishOAuthWindow(makeEvent(data), makeParams()),
      ).toBeUndefined()
    }
  })

  it('ignores a matching message with no redirectUri', async () => {
    const event = makeEvent({ name: 'JBrowseAuthWindow-testAccount' })
    expect(await finishOAuthWindow(event, makeParams())).toBeUndefined()
  })
})

describe('waitForOAuthMessage', () => {
  it('resolves when finish returns a token', async () => {
    const promise = waitForOAuthMessage(async () => 'my-token')
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    expect(await promise).toBe('my-token')
  })

  it('rejects when finish throws', async () => {
    const promise = waitForOAuthMessage(async () => {
      throw new Error('auth failed')
    })
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    await expect(promise).rejects.toThrow('auth failed')
  })

  it('keeps waiting when finish returns undefined', async () => {
    let callCount = 0
    const promise = waitForOAuthMessage(async () => {
      callCount++
      return callCount < 3 ? undefined : 'final-token'
    })
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    expect(await promise).toBe('final-token')
  })

  it('removes the event listener after resolving', async () => {
    let callCount = 0
    const promise = waitForOAuthMessage(async () => {
      callCount++
      return 'token'
    })
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    await promise
    // Fire more events — listener should be gone, callCount should not increase
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    expect(callCount).toBe(1)
  })

  it('removes the event listener after rejecting', async () => {
    let callCount = 0
    const promise = waitForOAuthMessage(async () => {
      callCount++
      throw new Error('fail')
    })
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    await expect(promise).rejects.toThrow('fail')
    window.dispatchEvent(new MessageEvent('message', { data: {} }))
    expect(callCount).toBe(1)
  })
})
