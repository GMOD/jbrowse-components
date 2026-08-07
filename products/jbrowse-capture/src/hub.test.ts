import { hubUrl as coreHubUrl } from '@jbrowse/core/util/fetchHub'

import { hubUrl } from './hub.ts'

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
