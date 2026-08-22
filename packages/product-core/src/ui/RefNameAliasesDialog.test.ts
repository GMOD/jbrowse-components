import { alignRows, formatRows } from './RefNameAliasesDialog.tsx'

const hg38: [string, string[]][] = [
  ['chr7', ['chr7', '7', 'CM000669.2', 'NC_000007.14']],
  [
    'chr7_GL383534v2_alt',
    ['chr7_GL383534v2_alt', 'GL383534.2', 'HSCHR7_1_CTG6'],
  ],
]

// what the copy button puts on the clipboard, and what the display shows, are
// deliberately not the same string: the clipboard one pastes into a spreadsheet
// as two columns, so its separator is a tab and the names carry no padding
test('the copied rows are tab-separated, with no alignment padding', () => {
  expect(formatRows(hg38)).toBe(
    'chr7\t7, CM000669.2, NC_000007.14\n' +
      'chr7_GL383534v2_alt\tGL383534.2, HSCHR7_1_CTG6',
  )
})

// a tab is 8 columns wide in a <pre>, so these two rows straddle a tab stop and
// read as two ragged columns; the display pads to the widest name instead
test('the displayed rows pad the name column to the widest name', () => {
  expect(alignRows(hg38)).toBe(
    'chr7                 7, CM000669.2, NC_000007.14\n' +
      'chr7_GL383534v2_alt  GL383534.2, HSCHR7_1_CTG6',
  )
})

// a GenArk contig name runs to 60 characters, and padding every row out to one
// of those indents the aliases off the right edge of the dialog
test('a name past the cap indents its own row only', () => {
  const long = 'GWHBJBH00000001.1_some_very_long_genark_contig_name'
  const rows: [string, string[]][] = [
    ['chr1', ['chr1', '1']],
    [long, [long, 'x']],
  ]
  expect(alignRows(rows)).toBe(`chr1${' '.repeat(26)}  1\n${long}  x`)
})

test('a contig with no aliases is a row with an empty second column', () => {
  expect(formatRows([['ctgA', ['ctgA']]])).toBe('ctgA\t')
  expect(alignRows([['ctgA', ['ctgA']]])).toBe('ctgA  ')
})
