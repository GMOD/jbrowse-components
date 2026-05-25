import { getDescriptiveErrorMessage } from './util.ts'

describe('getDescriptiveErrorMessage', () => {
  it('extracts message from Google Drive error response', async () => {
    const body = JSON.stringify({
      error: {
        errors: [
          {
            domain: 'usageLimits',
            reason: 'accessNotConfigured',
            message: 'Access not configured',
          },
        ],
        code: 403,
        message: 'Access not configured',
      },
    })
    const response = new Response(body, { status: 403 })
    const msg = await getDescriptiveErrorMessage(response)
    expect(msg).toContain('Access not configured')
  })

  it('falls back to HTTP status on non-JSON response', async () => {
    const response = new Response('not json', { status: 500 })
    const msg = await getDescriptiveErrorMessage(response)
    expect(msg).toBe('HTTP 500')
  })

  it('includes optional reason in message', async () => {
    const body = JSON.stringify({
      error: {
        errors: [],
        code: 401,
        message: 'Invalid credentials',
      },
    })
    const response = new Response(body, { status: 401 })
    const msg = await getDescriptiveErrorMessage(response, 'Listing files')
    expect(msg).toContain('Listing files')
    expect(msg).toContain('Invalid credentials')
  })
})
