import { processError, processTokenResponse } from './util.ts'

describe('processError', () => {
  it('calls callback and returns error_description on invalid_grant', () => {
    const cb = jest.fn()
    const result = processError(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Token expired',
      }),
      cb,
    )
    expect(cb).toHaveBeenCalledTimes(1)
    expect(result).toBe('Token expired')
  })

  it('does not call callback for other error types', () => {
    const cb = jest.fn()
    const result = processError(
      JSON.stringify({
        error: 'access_denied',
        error_description: 'Access denied',
      }),
      cb,
    )
    expect(cb).not.toHaveBeenCalled()
    expect(result).toBe('Access denied')
  })

  it('falls back to original text when no error_description', () => {
    const cb = jest.fn()
    const original = JSON.stringify({ error: 'something_else' })
    const result = processError(original, cb)
    expect(result).toBe(original)
  })

  it('returns original text for non-JSON input', () => {
    const cb = jest.fn()
    const original = 'plain error text'
    expect(processError(original, cb)).toBe(original)
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('processTokenResponse', () => {
  it('returns access_token and stores refresh_token when present', () => {
    const cb = jest.fn()
    const token = processTokenResponse(
      { access_token: 'access123', refresh_token: 'refresh456' },
      cb,
    )
    expect(token).toBe('access123')
    expect(cb).toHaveBeenCalledWith('refresh456')
  })

  it('returns access_token without calling cb when refresh_token absent', () => {
    const cb = jest.fn()
    const token = processTokenResponse({ access_token: 'access123' }, cb)
    expect(token).toBe('access123')
    expect(cb).not.toHaveBeenCalled()
  })
})
