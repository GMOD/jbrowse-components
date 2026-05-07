import { getError, getResponseError } from './util.ts'

describe('getError', () => {
  it('returns response body text', async () => {
    const response = new Response('something went wrong')
    expect(await getError(response)).toBe('something went wrong')
  })
})

describe('getResponseError', () => {
  it('formats message with status, reason, and statusText', async () => {
    const response = new Response('', { status: 401 })
    const msg = await getResponseError({
      response,
      reason: 'Token invalid',
      statusText: 'Unauthorized',
    })
    expect(msg).toBe('HTTP 401 - Token invalid - Unauthorized')
  })

  it('reads response body when statusText is not provided', async () => {
    const response = new Response('Server error', { status: 500 })
    const msg = await getResponseError({ response, reason: 'Server failed' })
    expect(msg).toBe('HTTP 500 - Server failed - Server error')
  })

  it('omits empty parts from message', async () => {
    const response = new Response('', { status: 403 })
    const msg = await getResponseError({ response, statusText: '' })
    expect(msg).toBe('HTTP 403')
  })

  it('includes only status when no reason or body', async () => {
    const response = new Response('', { status: 404 })
    const msg = await getResponseError({ response })
    expect(msg).toBe('HTTP 404')
  })
})
