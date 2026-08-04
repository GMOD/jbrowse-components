import {
  locationWarnings,
  parseUrlList,
  resolveTrackNames,
  withEditedName,
} from './util.ts'

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
        rows: [
          rowOf('r1', 'a.bam'),
          rowOf('r2', 'a.vcf.gz'),
          rowOf('r3', 'b.bam'),
        ],
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

  test('autoName is the name with no user edit applied', () => {
    expect(
      resolveTrackNames({
        rows: [rowOf('r1', 'volvox.vcf.gz')],
        customNames: { r1: 'My variants' },
        stripExtensions: true,
      }),
    ).toEqual([
      expect.objectContaining({ name: 'My variants', autoName: 'volvox' }),
    ])
  })
})

describe('withEditedName', () => {
  const args = { id: 'r1', autoName: 'a.bam' }

  test('records a name the user typed', () => {
    expect(withEditedName({ ...args, customNames: {}, name: 'mine' })).toEqual({
      r1: 'mine',
    })
  })

  test('trims what it records', () => {
    expect(
      withEditedName({ ...args, customNames: {}, name: '  mine  ' }),
    ).toEqual({ r1: 'mine' })
  })

  // the grid fires processRowUpdate on every commit, including one where the
  // user opened the cell and typed nothing; recording that would silently opt
  // the row out of the strip-extensions toggle
  test('a commit that leaves the automatic name records nothing', () => {
    const customNames = {}
    expect(withEditedName({ ...args, customNames, name: 'a.bam' })).toBe(
      customNames,
    )
  })

  test('retyping the automatic name drops an existing rename', () => {
    expect(
      withEditedName({ ...args, customNames: { r1: 'mine' }, name: 'a.bam' }),
    ).toEqual({})
  })

  test('clearing the cell drops the rename rather than adding an empty name', () => {
    expect(
      withEditedName({ ...args, customNames: { r1: 'mine' }, name: '   ' }),
    ).toEqual({})
  })

  test('leaves other rows alone', () => {
    expect(
      withEditedName({ ...args, customNames: { r2: 'other' }, name: 'mine' }),
    ).toEqual({ r1: 'mine', r2: 'other' })
  })

  test('an unchanged rename returns the same map', () => {
    const customNames = { r1: 'mine' }
    expect(withEditedName({ ...args, customNames, name: 'mine' })).toBe(
      customNames,
    )
  })
})
