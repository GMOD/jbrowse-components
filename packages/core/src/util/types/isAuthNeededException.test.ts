import {
  deserializeError,
  serializeError,
} from '../../rpc/serializeError/index.ts'
import { AuthNeededError, isAuthNeededException } from './index.ts'

describe('isAuthNeededException', () => {
  it('recognizes the error', () => {
    expect(
      isAuthNeededException(
        new AuthNeededError('need auth', 'https://example.com/x.bam'),
      ),
    ).toBe(true)
  })

  it('recognizes one that crossed the worker boundary', () => {
    const round = deserializeError(
      serializeError(new AuthNeededError('need auth', 'https://example.com')),
    )
    expect(isAuthNeededException(round)).toBe(true)
    expect(round).not.toBeInstanceOf(AuthNeededError)
  })

  // an ordinary fetch failure that happens to carry a url used to match, which
  // sent RpcManager down its auth-retry path and prompted for a login
  it('does not claim an ordinary error carrying a url', () => {
    const error = Object.assign(new Error('404 fetching data'), {
      url: 'https://example.com/x.bam',
    })
    expect(isAuthNeededException(error)).toBe(false)
  })

  it('does not claim a non-error', () => {
    expect(isAuthNeededException({ name: 'AuthNeededError' })).toBe(false)
    expect(isAuthNeededException(undefined)).toBe(false)
  })
})
