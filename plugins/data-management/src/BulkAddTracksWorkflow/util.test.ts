import { locationWarnings, parseUrlList, resolveTrackNames } from './util.ts'

import type { TrackConfRow } from './buildConfigs.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

function uri(s: string): FileLocation {
  return { uri: s, locationType: 'UriLocation' }
}

test('parses one url per line into uri locations', () => {
  expect(parseUrlList('https://a.com/x.bam\nhttp://a.com/x.bam.bai')).toEqual([
    { uri: 'https://a.com/x.bam', locationType: 'UriLocation' },
    { uri: 'http://a.com/x.bam.bai', locationType: 'UriLocation' },
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

describe('resolveTrackNames', () => {
  function rowOf(id: string, name: string) {
    return { id, name, status: 'ok' } as TrackConfRow
  }
  function namesOf(args: {
    rows: TrackConfRow[]
    customNames?: Record<string, string>
    stripExtensions: boolean
  }) {
    return resolveTrackNames({
      customNames: {},
      ...args,
    }).map(({ name }) => name)
  }

  test('keeps full filenames when not stripping', () => {
    expect(
      namesOf({
        rows: [rowOf('r1', 'volvox.vcf.gz')],
        stripExtensions: false,
      }),
    ).toEqual(['volvox.vcf.gz'])
  })

  test('strips extensions when toggled on', () => {
    expect(
      namesOf({
        rows: [rowOf('r1', 'volvox.vcf.gz'), rowOf('r2', 'other.bam')],
        stripExtensions: true,
      }),
    ).toEqual(['volvox', 'other'])
  })

  test('an explicit rename wins over the strip toggle', () => {
    expect(
      namesOf({
        rows: [rowOf('r1', 'volvox.vcf.gz')],
        customNames: { r1: 'My variants' },
        stripExtensions: true,
      }),
    ).toEqual(['My variants'])
  })

  test('colliding rows keep their extensions so they stay distinguishable', () => {
    expect(
      namesOf({
        rows: [rowOf('r1', 'a.bam'), rowOf('r2', 'a.vcf.gz')],
        stripExtensions: true,
      }),
    ).toEqual(['a.bam', 'a.vcf.gz'])
  })

  test('a collision only un-strips the rows involved', () => {
    expect(
      namesOf({
        rows: [rowOf('r1', 'a.bam'), rowOf('r2', 'a.vcf.gz'), rowOf('r3', 'b.bam')],
        stripExtensions: true,
      }),
    ).toEqual(['a.bam', 'a.vcf.gz', 'b'])
  })

  test('collisions are ignored when the toggle is off', () => {
    expect(
      namesOf({
        rows: [rowOf('r1', 'a.bam'), rowOf('r2', 'a.vcf.gz')],
        stripExtensions: false,
      }),
    ).toEqual(['a.bam', 'a.vcf.gz'])
  })
})
