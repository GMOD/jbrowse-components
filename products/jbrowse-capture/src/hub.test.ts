import { hubUrl as coreHubUrl } from '@jbrowse/core/util/fetchHub'

import { fetchHubConfig, hubUrl } from './hub.ts'

// hub.ts explains why the mapping is copied rather than imported. This is the
// guard that makes the copy safe: if core's URL scheme ever moves, one of these
// fails rather than this package quietly fetching from the old location.
const HUBS = [
  'hg38',
  'hg19',
  'mm39',
  'hs1',
  'GCA_964188535.1',
  'GCF_000001405.40',
  'GCA_000001405.15',
]

test.each(HUBS)('%s resolves the same as core hubUrl', hub => {
  expect(hubUrl(hub)).toBe(coreHubUrl(hub))
})

test('a UCSC db name maps to /ucsc/<db>/config.json', () => {
  expect(hubUrl('hg38')).toBe('https://jbrowse.org/ucsc/hg38/config.json')
})

test('a GenArk accession fans its digits into a directory tree', () => {
  expect(hubUrl('GCA_964188535.1')).toBe(
    'https://jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json',
  )
})

test('a timed-out fetch names the hub, the URL and the budget', async () => {
  const timedOut = new Error('The operation was aborted due to timeout')
  timedOut.name = 'TimeoutError'
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(timedOut)
  await expect(fetchHubConfig('hg38')).rejects.toThrow(
    'hub "hg38" could not be fetched from https://jbrowse.org/ucsc/hg38/config.json (The operation was aborted due to timeout, after 30000ms)',
  )
  fetchSpy.mockRestore()
})

// The budget belongs only in the failure it explains: on a DNS error it reads as
// though the request had been given 30s to resolve.
test('a fetch that failed for another reason does not blame the budget', async () => {
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('getaddrinfo ENOTFOUND jbrowse.org'))
  await expect(fetchHubConfig('hg38')).rejects.toThrow(
    'hub "hg38" could not be fetched from https://jbrowse.org/ucsc/hg38/config.json (getaddrinfo ENOTFOUND jbrowse.org).',
  )
  fetchSpy.mockRestore()
})
