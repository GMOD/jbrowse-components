import {
  finishOAuthRedirect,
  getOAuthRedirectUri,
  waitForOAuthMessage,
} from './util.ts'

import type { OAuthRedirectParams } from './util.ts'

function makeParams(
  overrides?: Partial<OAuthRedirectParams>,
): OAuthRedirectParams {
  return {
    expectedState: 'st',
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
      'http://localhost/auth#access_token=my-token&token_type=bearer&state=st',
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
      'http://localhost/auth?code=auth-code&state=st',
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

  // rewriting the '#' into a '?' gave the URL two of them, and the whole
  // fragment then parsed as one value of the last query parameter
  it('reads the fragment even when the redirect also carries a query', async () => {
    const token = await finishOAuthRedirect(
      'http://localhost/auth?session=abc#access_token=my-token&state=s',
      makeParams({ expectedState: 's' }),
    )
    expect(token).toBe('my-token')
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
        'http://localhost/auth?error=access_denied&state=st',
        makeParams(),
      ),
    ).rejects.toThrow('OAuth flow was cancelled')
  })

  it('throws "OAuth flow error: X" for other errors', async () => {
    await expect(
      finishOAuthRedirect(
        'http://localhost/auth?error=server_error&state=st',
        makeParams(),
      ),
    ).rejects.toThrow('OAuth flow error: server_error')
  })

  it('returns undefined when redirect has no token, code, or error', async () => {
    expect(
      await finishOAuthRedirect('http://localhost/auth?state=st', makeParams()),
    ).toBeUndefined()
  })
})

describe('getOAuthRedirectUri', () => {
  it('returns the redirect this account posts back', () => {
    const event = makeRedirectEvent('http://localhost/auth?code=c&state=st')
    expect(getOAuthRedirectUri(event, 'testAccount')).toBe(
      'http://localhost/auth?code=c&state=st',
    )
  })

  it('returns undefined when event name does not match', () => {
    const event = makeEvent({
      name: 'JBrowseAuthWindow-otherAccount',
      redirectUri: 'http://x/?code=abc',
    })
    expect(getOAuthRedirectUri(event, 'testAccount')).toBeUndefined()
  })

  it('ignores a message from another origin', () => {
    const event = makeEvent(
      {
        name: 'JBrowseAuthWindow-testAccount',
        redirectUri: 'http://localhost/auth#access_token=injected',
      },
      'https://evil.example.com',
    )
    expect(getOAuthRedirectUri(event, 'testAccount')).toBeUndefined()
  })

  it('ignores messages whose data is not an object', () => {
    for (const data of [null, undefined, 'a string', 42]) {
      expect(
        getOAuthRedirectUri(makeEvent(data), 'testAccount'),
      ).toBeUndefined()
    }
  })

  it('ignores a matching message with no string redirectUri', () => {
    for (const data of [
      { name: 'JBrowseAuthWindow-testAccount' },
      { name: 'JBrowseAuthWindow-testAccount', redirectUri: 42 },
    ]) {
      expect(
        getOAuthRedirectUri(makeEvent(data), 'testAccount'),
      ).toBeUndefined()
    }
  })
})

describe('waitForOAuthMessage', () => {
  function wait(
    finish: (redirectUri: string) => Promise<string | undefined>,
    popup = { closed: false },
  ) {
    return waitForOAuthMessage({
      popup,
      internetAccountId: 'testAccount',
      finish,
    })
  }

  function postRedirect(redirectUri = 'http://localhost/auth?code=c') {
    window.dispatchEvent(makeRedirectEvent(redirectUri))
  }

  it('finishes the redirect this account posts back', async () => {
    const finish = jest.fn(async () => 'my-token')
    const promise = wait(finish)
    postRedirect('http://localhost/auth?code=abc')
    expect(await promise).toBe('my-token')
    expect(finish).toHaveBeenCalledWith('http://localhost/auth?code=abc')
  })

  it('never hands another message to finish', async () => {
    const finish = jest.fn(async () => 'my-token')
    const promise = wait(finish)
    window.dispatchEvent(makeEvent(null))
    window.dispatchEvent(
      makeEvent({ name: 'JBrowseAuthWindow-otherAccount', redirectUri: 'x' }),
    )
    postRedirect()
    expect(await promise).toBe('my-token')
    expect(finish).toHaveBeenCalledTimes(1)
  })

  it('rejects when finish throws', async () => {
    const promise = wait(async () => {
      throw new Error('auth failed')
    })
    postRedirect()
    await expect(promise).rejects.toThrow('auth failed')
  })

  it('keeps waiting when finish returns undefined', async () => {
    let callCount = 0
    const promise = wait(async () => {
      callCount++
      return callCount < 3 ? undefined : 'final-token'
    })
    postRedirect()
    postRedirect()
    postRedirect()
    expect(await promise).toBe('final-token')
  })

  it('removes the event listener after resolving', async () => {
    const finish = jest.fn(async () => 'token')
    const promise = wait(finish)
    postRedirect()
    await promise
    postRedirect()
    postRedirect()
    expect(finish).toHaveBeenCalledTimes(1)
  })

  it('removes the event listener after rejecting', async () => {
    const finish = jest.fn(async () => {
      throw new Error('fail')
    })
    const promise = wait(finish)
    postRedirect()
    await expect(promise).rejects.toThrow('fail')
    postRedirect()
    expect(finish).toHaveBeenCalledTimes(1)
  })

  describe('watching the popup', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    // getToken caches this promise, so a pending one is not a flow still in
    // progress — it is an account that will never authenticate again
    it('rejects when the user closes the popup', async () => {
      const popup = { closed: false }
      const promise = wait(async () => undefined, popup)
      popup.closed = true
      jest.advanceTimersByTime(2000)
      await expect(promise).rejects.toThrow('OAuth flow was cancelled')
    })

    // the popup posts its redirect and then closes itself, and the code flow
    // spends a token exchange finishing — a close is not a cancellation while
    // one of ours is in hand
    it('does not cancel a redirect that is still being finished', async () => {
      const popup = { closed: false }
      let finishRedirect: (token: string) => void
      const promise = wait(
        async () =>
          new Promise<string>(resolve => {
            finishRedirect = resolve
          }),
        popup,
      )
      postRedirect()
      await Promise.resolve()

      popup.closed = true
      jest.advanceTimersByTime(5000)
      finishRedirect!('exchanged-token')
      expect(await promise).toBe('exchanged-token')
    })

    it('cancels after a redirect of ours that completed nothing', async () => {
      const popup = { closed: false }
      const promise = wait(async () => undefined, popup)
      postRedirect('http://localhost/auth?state=st')
      await Promise.resolve()

      popup.closed = true
      jest.advanceTimersByTime(2000)
      await expect(promise).rejects.toThrow('OAuth flow was cancelled')
    })

    it('stops polling once the flow completes', async () => {
      const popup = { closed: false }
      const promise = wait(async () => 'token', popup)
      postRedirect()
      expect(await promise).toBe('token')

      popup.closed = true
      jest.advanceTimersByTime(5000)
      expect(jest.getTimerCount()).toBe(0)
    })
  })
})
