import {
  compareValues,
  csvLine,
  searchHighlightPatterns,
  splitSearchWords,
} from './tableText.ts'

describe('csvLine', () => {
  test('quotes a field holding a comma, a quote or a line break', () => {
    expect(csvLine(['plain', 'a, "b"', 'line\nbreak'])).toBe(
      'plain,"a, ""b""","line\nbreak"',
    )
  })

  test('a field a spreadsheet would run as a formula gets a leading quote', () => {
    expect(
      csvLine(['=SUM(A1:A9)', '+cmd|x', '-2+3', '@id', '=HYPERLINK("x")']),
    ).toBe(`"'=SUM(A1:A9)","'+cmd|x","'-2+3","'@id","'=HYPERLINK(""x"")"`)
  })

  test('a signed number is a number, not a formula', () => {
    expect(csvLine(['-100', '+5', '-1.5e-3', '-.5'])).toBe(
      '-100,+5,-1.5e-3,-.5',
    )
  })
})

test('a blank sorts last in either direction', () => {
  const values = ['b', '', 'a10', undefined, 'a2']
  expect([...values].sort((a, b) => compareValues(a, b, 1))).toEqual([
    'a2',
    'a10',
    'b',
    '',
    undefined,
  ])
  expect([...values].sort((a, b) => compareValues(a, b, -1))).toEqual([
    'b',
    'a10',
    'a2',
    '',
    undefined,
  ])
})

test('search words split on any whitespace and highlight literally', () => {
  const words = splitSearchWords(' Chr1\t a.b ')
  expect(words).toEqual(['chr1', 'a.b'])
  expect(
    searchHighlightPatterns(words).map(p => 'CHR1 axb a.b'.match(p)),
  ).toEqual([['CHR1'], ['a.b']])
})
