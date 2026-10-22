import { listHubTracks } from './genome.ts'

test('a timed-out fetch names the genome, the URL and the budget', async () => {
  const timedOut = new Error('The operation was aborted due to timeout')
  timedOut.name = 'TimeoutError'
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(timedOut)
  await expect(listHubTracks('hg38')).rejects.toThrow(
    'genome "hg38" could not be fetched from https://jbrowse.org/ucsc/hg38/config.json (The operation was aborted due to timeout, after 30000ms)',
  )
  fetchSpy.mockRestore()
})

// The budget belongs only in the failure it explains: on a DNS error it reads as
// though the request had been given 30s to resolve.
test('a fetch that failed for another reason does not blame the budget', async () => {
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('getaddrinfo ENOTFOUND jbrowse.org'))
  await expect(listHubTracks('hg38')).rejects.toThrow(
    'genome "hg38" could not be fetched from https://jbrowse.org/ucsc/hg38/config.json (getaddrinfo ENOTFOUND jbrowse.org).',
  )
  fetchSpy.mockRestore()
})
