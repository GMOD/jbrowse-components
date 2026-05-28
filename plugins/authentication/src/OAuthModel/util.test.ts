import { finishOAuthWindow, waitForOAuthMessage } from './util.ts'

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

function makeEvent(redirectUri: string) {
  return new MessageEvent('message', {
    data: { name: 'JBrowseAuthWindow-testAccount', redirectUri },
  })
}

describe('finishOAuthWindow', () => {
  it('returns undefined when event name does not match', async () => {
    const event = new MessageEvent('message', {
      data: {
        name: 'JBrowseAuthWindow-otherAccount',
        redirectUri: 'http://x/?code=abc',
      },
    })
    expect(await finishOAuthWindow(event, makeParams())).toBeUndefined()
  })

  it('returns access_token from implicit flow (hash fragment)', async () => {
    const stored: string[] = []
    const event = makeEvent(
      'http://localhost/auth#access_token=my-token&token_type=bearer',
    )
    const token = await finishOAuthWindow(
      event,
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
    const event = makeEvent('http://localhost/auth?code=auth-code')
    const token = await finishOAuthWindow(
      event,
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
    const event = makeEvent('http://localhost/auth?code=abc&state=wrong')
    await expect(
      finishOAuthWindow(event, makeParams({ expectedState: 'expected' })),
    ).rejects.toThrow('OAuth state mismatch')
  })

  it('passes state check when state matches', async () => {
    const event = makeEvent('http://localhost/auth?code=abc&state=correct')
    const token = await finishOAuthWindow(
      event,
      makeParams({ expectedState: 'correct' }),
    )
    expect(token).toBe('exchanged-token')
  })

  it('throws "OAuth flow was cancelled" for access_denied error', async () => {
    const event = makeEvent('http://localhost/auth?error=access_denied')
    await expect(finishOAuthWindow(event, makeParams())).rejects.toThrow(
      'OAuth flow was cancelled',
    )
  })

  it('throws "OAuth flow error: X" for other errors', async () => {
    const event = makeEvent('http://localhost/auth?error=server_error')
    await expect(finishOAuthWindow(event, makeParams())).rejects.toThrow(
      'OAuth flow error: server_error',
    )
  })

  it('returns undefined when redirect has no token, code, or error', async () => {
    const event = makeEvent('http://localhost/auth')
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
