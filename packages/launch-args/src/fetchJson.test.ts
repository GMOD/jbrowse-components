import { HOSTED_HINT, fetchJson } from './fetchJson.ts'

const URL = 'https://jbrowse.org/ucsc/hg38/config.json'

afterEach(() => {
  jest.restoreAllMocks()
})

test('a timed-out fetch names what was fetched, the URL and the budget', async () => {
  const timedOut = new Error('The operation was aborted due to timeout')
  timedOut.name = 'TimeoutError'
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(timedOut)
  await expect(fetchJson(URL, 'genome "hg38"', HOSTED_HINT)).rejects.toThrow(
    `genome "hg38" could not be fetched from ${URL} (The operation was aborted due to timeout, after 30000ms). ${HOSTED_HINT}`,
  )
})

// The budget belongs only in the failure it explains: on a DNS error it reads as
// though the request had been given 30s to resolve.
test('a fetch that failed for another reason does not blame the budget', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('getaddrinfo ENOTFOUND jbrowse.org'))
  await expect(fetchJson(URL, 'genome "hg38"')).rejects.toThrow(
    `genome "hg38" could not be fetched from ${URL} (getaddrinfo ENOTFOUND jbrowse.org).`,
  )
})

test('an HTTP error names the status, with the hint only when given', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('', { status: 404 }))
  await expect(fetchJson(URL, '--config')).rejects.toThrow(
    new Error(`--config not found (HTTP 404 from ${URL}).`),
  )
})
