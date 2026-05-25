import { getDescriptiveErrorMessage } from './util.ts'

describe('getDescriptiveErrorMessage', () => {
  it('returns mapped message for known error tags', async () => {
    const body = JSON.stringify({
      error_summary: 'shared_link_not_found/...',
      error: { '.tag': 'shared_link_not_found' },
    })
    const response = new Response(body, { status: 409 })
    const msg = await getDescriptiveErrorMessage(response)
    expect(msg).toContain("The shared link wasn't found.")
  })

  it('returns tag itself for unmapped error codes', async () => {
    const body = JSON.stringify({
      error_summary: 'unknown_tag/...',
      error: { '.tag': 'unknown_tag' },
    })
    const response = new Response(body, { status: 409 })
    const msg = await getDescriptiveErrorMessage(response)
    expect(msg).toContain('unknown_tag')
  })

  it('falls back to HTTP status on non-JSON response', async () => {
    const response = new Response('not json', { status: 500 })
    const msg = await getDescriptiveErrorMessage(response)
    expect(msg).toBe('HTTP 500')
  })

  it('includes optional reason in message', async () => {
    const body = JSON.stringify({
      error_summary: 'shared_link_access_denied/...',
      error: { '.tag': 'shared_link_access_denied' },
    })
    const response = new Response(body, { status: 403 })
    const msg = await getDescriptiveErrorMessage(response, 'Fetching file')
    expect(msg).toContain('Fetching file')
    expect(msg).toContain(
      'The caller is not allowed to access this shared link.',
    )
  })
})
