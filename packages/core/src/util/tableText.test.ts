import {
  compareValues,
  csvLine,
  csvText,
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

  test('a lone strand sign stays as written', () => {
    expect(csvLine(['+', '-'])).toBe('+,-')
  })

  test('a leading tab or carriage return is escaped too', () => {
    expect(csvLine(['\t=1', '\r=1'])).toBe(`"'\t=1","'\r=1"`)
  })
})

test('csvText puts the header line first and joins lines with CRLF', () => {
  expect(
    csvText(
      ['a', 'b'],
      [
        ['1', '2'],
        ['=x', ''],
      ],
    ),
  ).toBe(`a,b\r\n1,2\r\n"'=x",`)
})

test('strings that are plain numbers sort by value', () => {
  const values = ['0.5', '0.125', '-10', '0.25', '-2', '1e3', '3']
  expect([...values].sort((a, b) => compareValues(a, b, 1))).toEqual([
    '-10',
    '-2',
    '0.125',
    '0.25',
    '0.5',
    '3',
    '1e3',
  ])
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
