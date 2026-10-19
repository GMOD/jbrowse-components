import { describedColumns, fieldExpression } from './jexlFilterFields.ts'

test('a field inserts the expression that reads it', () => {
  expect(fieldExpression({ label: 'AF', path: ['INFO', 'AF'] })).toBe(
    'feature.INFO.AF',
  )
  expect(fieldExpression({ label: 'sig', path: ['INFO', 'CLN-SIG'] })).toBe(
    "feature.INFO['CLN-SIG']",
  )
  expect(fieldExpression({ label: 'maf', call: 'maf' })).toBe('maf(feature)')
})

test("a BigBed's autoSql columns join the fields it does not list", () => {
  const fields = [{ label: 'name', path: ['name'], type: 'text' as const }]
  expect(
    describedColumns(
      {
        chrom: 'Chromosome (or contig, scaffold, etc.)',
        chromStart: 'Start position in chromosome',
        chromEnd: 'End position in chromosome',
        name: 'md5 of data used as a key into external data file',
        AF: 'Allele Frequency',
        _dataLen: '',
      },
      fields,
    ),
  ).toEqual([
    { label: 'AF', path: ['AF'], description: 'Allele Frequency' },
    { label: '_dataLen', path: ['_dataLen'], description: undefined },
  ])
  expect(
    describedColumns({ columnNumbers: { ref: 1 }, metaChar: '#' }, fields),
  ).toEqual([])
  expect(describedColumns(undefined, fields)).toEqual([])
})
