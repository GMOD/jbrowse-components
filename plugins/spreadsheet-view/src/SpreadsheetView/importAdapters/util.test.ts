import { parseBedBuffer } from './BedImport.ts'

const enc = (s: string) => new TextEncoder().encode(s)

const columnNames = (bed: string) =>
  parseBedBuffer(enc(bed)).columns.map(c => c.name)
const firstRow = (bed: string) => parseBedBuffer(enc(bed)).rowSet.rows[0]!

// Regression: the header used to decide the column list outright, so every data
// column past its last name disappeared — from the column list and from every
// row, with nothing on screen to say a column had been dropped
test('a header that names fewer extra columns than the data has', () => {
  const bed = [
    '#chr\tstart\tend\tname\tscore\tstrand\tgene_name',
    'chr1\t100\t250\tf1\t0\t+\tBRCA1\textra1\textra2',
  ].join('\n')
  expect(columnNames(bed).slice(6)).toEqual(['gene_name', 'field_1', 'field_2'])
  expect(firstRow(bed).cellData).toMatchObject({
    gene_name: 'BRCA1',
    field_1: 'extra1',
    field_2: 'extra2',
  })
})

// the same bug in its likeliest spelling: the "header" is whatever `#` line
// comes last before the data, and a provenance comment carrying a tab is
// indistinguishable from a real column header
test('a leading comment that merely happens to contain a tab', () => {
  const bed = [
    '#produced by\tsome tool',
    'chr1\t100\t250\tf1\t0\t+\tBRCA1',
  ].join('\n')
  expect(columnNames(bed).slice(6)).toEqual(['field_0'])
  expect(firstRow(bed).cellData).toMatchObject({ field_0: 'BRCA1' })
})

// a header that names more than the first data row has still wins: BED files
// can be ragged, and a later row may populate what the first one omits
test('a header that names more extra columns than the first row has', () => {
  const bed = [
    '#chr\tstart\tend\tname\tscore\tstrand\ta\tb',
    'chr1\t100\t250\tf1\t0\t+\tone',
  ].join('\n')
  expect(columnNames(bed).slice(6)).toEqual(['a', 'b'])
})

// Regression: `browser` and `track` are whole-word directives in the UCSC spec,
// but were matched as bare prefixes, so a contig named for one was dropped
test('a contig whose name merely starts with a directive keyword', () => {
  const bed = ['track1\t100\t250\tf1\t0\t+', 'chr1\t300\t450\tf2\t0\t-'].join(
    '\n',
  )
  expect(
    parseBedBuffer(enc(bed)).rowSet.rows.map(r => r.cellData.refName),
  ).toEqual(['track1', 'chr1'])
})

test('real directive lines are still dropped', () => {
  const bed = [
    'browser position chr1:100-500',
    'track name="Sample" description="x"',
    'chr1\t100\t250\tf1\t0\t+',
  ].join('\n')
  expect(parseBedBuffer(enc(bed)).rowSet.rows).toHaveLength(1)
})
