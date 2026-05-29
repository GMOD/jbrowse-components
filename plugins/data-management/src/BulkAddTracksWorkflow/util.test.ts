import { parseUrlList } from './util.ts'

test('parses one url per line into uri locations', () => {
  expect(parseUrlList('http://a.com/x.bam\nhttp://a.com/x.bam.bai')).toEqual([
    { uri: 'http://a.com/x.bam', locationType: 'UriLocation' },
    { uri: 'http://a.com/x.bam.bai', locationType: 'UriLocation' },
  ])
})

test('ignores blank lines and surrounding whitespace', () => {
  expect(parseUrlList('  http://a.com/x.bw  \n\n   \n')).toEqual([
    { uri: 'http://a.com/x.bw', locationType: 'UriLocation' },
  ])
})

test('returns empty for empty input', () => {
  expect(parseUrlList('')).toEqual([])
})
