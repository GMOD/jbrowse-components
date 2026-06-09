import { locationWarnings, parseUrlList } from './util.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

test('parses one url per line into uri locations', () => {
  expect(parseUrlList('https://a.com/x.bam\nhttp://a.com/x.bam.bai')).toEqual([
    { uri: 'https://a.com/x.bam', locationType: 'UriLocation' },
    { uri: 'https://a.com/x.bam.bai', locationType: 'UriLocation' },
  ])
})

test('ignores blank lines and surrounding whitespace', () => {
  expect(parseUrlList('  https://a.com/x.bw  \n\n   \n')).toEqual([
    { uri: 'https://a.com/x.bw', locationType: 'UriLocation' },
  ])
})

test('returns empty for empty input', () => {
  expect(parseUrlList('')).toEqual([])
})

test('no warnings for plain absolute https urls', () => {
  expect(locationWarnings([uri('https://a.com/x.bam')])).toEqual([])
})

test('warns about ftp urls with count', () => {
  const warnings = locationWarnings([
    uri('ftp://a.com/x.bam'),
    uri('ftp://a.com/y.bam'),
  ])
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('2 URLs use')
})

test('warns about relative urls but not absolute or ftp ones', () => {
  const warnings = locationWarnings([
    uri('data/x.bam'),
    uri('https://a.com/y.bam'),
    uri('ftp://a.com/z.bam'),
  ])
  expect(warnings).toContainEqual(expect.stringContaining('1 URL is relative'))
})
