import createJexlInstance from './jexl.ts'
import {
  addRow,
  describedColumns,
  readFilterRows,
  removeRow,
  replaceRow,
  resolveFields,
  typedField,
  withField,
  withOp,
  writeFilterRows,
} from './jexlFilterRows.ts'

import type { ConditionRow, FilterRows } from './jexlFilterRows.ts'

const jexl = createJexlInstance()

const choices = resolveFields([
  { label: 'QUAL', path: ['QUAL'], type: 'number' },
  { label: 'FILTER', path: ['FILTER'], type: 'text', multi: true },
  { label: 'DB', path: ['INFO', 'DB'], type: 'flag' },
  { label: 'maf', call: 'maf', type: 'number' },
  { label: 'consequences', call: 'consequences', type: 'text' },
])

const read = (lines: string[]) => readFilterRows(lines, jexl, choices)

function conditionAt(state: FilterRows, index: number) {
  const row = state.rows[index]
  if (row?.kind !== 'condition') {
    throw new Error(`row ${index} is not a condition`)
  }
  return row
}

test('a line of conditions reads as one row each', () => {
  const state = read([
    "jexl:feature.QUAL >= 25 && feature.FILTER == 'PASS' && maf(feature) > 0.1",
  ])
  expect(
    state.rows.map(row =>
      row.kind === 'condition'
        ? [row.field?.label, row.op, row.value, row.line]
        : row.text,
    ),
  ).toEqual([
    ['QUAL', '>=', '25', 0],
    ['FILTER', '==', 'PASS', 0],
    ['maf', '>', '0.1', 0],
  ])
})

test('untouched lines write back byte-identical', () => {
  const lines = [
    "jexl:feature.QUAL>=25&&feature.FILTER=='PASS'",
    'jexl:feature.INFO.AC / feature.INFO.AN > 0.1',
    "jexl:get(feature,'score') > 5",
    'jexl:feature.QUAL >',
  ]
  expect(writeFilterRows(read(lines))).toEqual(lines)
})

test('editing one condition writes each row of its line alone', () => {
  const state = read([
    "jexl:feature.QUAL>=25&&feature.FILTER=='PASS'",
    'jexl:!feature.INFO.DB',
  ])
  const edited = replaceRow(state, { ...conditionAt(state, 0), value: '30' })
  expect(writeFilterRows(edited)).toEqual([
    'jexl:feature.QUAL >= 30',
    "jexl:feature.FILTER == 'PASS'",
    'jexl:!feature.INFO.DB',
  ])
})

test('removing a condition keeps its siblings', () => {
  const state = read(["jexl:feature.QUAL>=25&&feature.FILTER=='PASS'"])
  expect(writeFilterRows(removeRow(state, state.rows[0]!.id))).toEqual([
    "jexl:feature.FILTER == 'PASS'",
  ])
})

test('a line rows cannot express stays text', () => {
  const state = read([
    'jexl:feature.INFO.AC / feature.INFO.AN > 0.1',
    "jexl:'missense_variant' in consequences(feature)",
    "jexl:feature.QUAL > 30 && feature.FILTER != 'PASS' || maf(feature) > 0",
    'jexl:feature.QUAL >',
    "jexl:feature.QUAL == 'high'",
  ])
  expect(state.rows.map(row => row.kind)).toEqual([
    'text',
    'text',
    'text',
    'text',
    'text',
  ])
  expect(state.rows[0]).toMatchObject({
    text: 'feature.INFO.AC / feature.INFO.AN > 0.1',
  })
})

test('an edited text row is written with the prefix', () => {
  const state = read(['jexl:feature.INFO.AC / feature.INFO.AN > 0.1'])
  const row = state.rows[0]!
  expect(
    writeFilterRows(
      replaceRow(state, {
        kind: 'text',
        id: row.id,
        text: ' nAlt(feature) == 1 ',
      }),
    ),
  ).toEqual(['jexl:nAlt(feature) == 1'])
})

test('a field outside the list shows as its path, of no known type', () => {
  const state = read(['jexl:feature.INFO.AF[0] > 0.1'])
  expect(conditionAt(state, 0).field).toMatchObject({ label: 'INFO.AF[0]' })
  expect(conditionAt(state, 0).field?.type).toBeUndefined()
})

const generic = resolveFields([
  { label: 'name', path: ['name'], type: 'text' },
  { label: 'score', path: ['score'], type: 'number' },
  { label: 'annot', path: ['annot'], description: 'consequence class' },
])

function rowsOf(state: FilterRows) {
  return state.rows.map(row =>
    row.kind === 'condition' ? [row.field?.label, row.op, row.value] : row.text,
  )
}

test('columns of a feature track read back as rows', () => {
  expect(
    rowsOf(
      readFilterRows(
        [
          'jexl:feature.AF >= 0.001',
          "jexl:feature.annot == 'pLoF'",
          "jexl:get(feature,'score') > 400",
          "jexl:feature.AF < 0.5 && feature.annot in ['pLoF', 'missense']",
        ],
        jexl,
        generic,
      ),
    ),
  ).toEqual([
    ['AF', '>=', '0.001'],
    ['annot', '==', 'pLoF'],
    ['score', '>', '400'],
    ['AF', '<', '0.5'],
    ['annot', 'in', ['pLoF', 'missense']],
  ])
})

test('a value of no known type reads back only as it would be written', () => {
  expect(
    readFilterRows(
      ["jexl:feature.chr == '1'", "jexl:feature.AF >= '0.001'"],
      jexl,
      generic,
    ).rows.map(row => row.kind),
  ).toEqual(['text', 'text'])
})

test('a field of no known type writes numbers as numbers', () => {
  const af = withField(
    { kind: 'condition', id: 0, op: '==', value: '' },
    typedField('AF'),
  )
  const annot = withField({ ...af, id: 1 }, generic[2]!)
  expect(annot.field?.description).toBe('consequence class')
  expect(
    writeFilterRows({
      lines: [],
      rows: [
        { ...af, op: '>=', value: '0.001' },
        { ...annot, value: 'pLoF' },
        { ...annot, id: 2, op: 'in', value: ['pLoF', '1'] },
        { ...annot, id: 3, op: '~', value: '5' },
        { ...af, id: 4, op: '>', value: 'abc' },
      ],
    }),
  ).toEqual([
    'jexl:feature.AF >= 0.001',
    "jexl:feature.annot == 'pLoF'",
    "jexl:feature.annot in ['pLoF', 1]",
    "jexl:feature.annot ~ '5'",
    "jexl:feature.AF > 'abc'",
  ])
})

test('a new row is written once complete', () => {
  const state = addRow(read(["jexl:feature.FILTER == 'PASS'"]))
  const blank = conditionAt(state, 1)
  expect(writeFilterRows(state)).toEqual(["jexl:feature.FILTER == 'PASS'"])

  const qual = withField(blank, choices[0]!)
  expect(qual.op).toBe('>')
  const done = replaceRow(state, { ...qual, op: '>=', value: '25' })
  expect(writeFilterRows(done)).toEqual([
    "jexl:feature.FILTER == 'PASS'",
    'jexl:feature.QUAL >= 25',
  ])
})

test('is one of writes a list, and switching operator keeps the value', () => {
  const row: ConditionRow = withField(
    { kind: 'condition', id: 0, op: '==', value: '' },
    choices[1]!,
  )
  const list = withOp({ ...row, value: 'PASS' }, 'in')
  expect(list.value).toEqual(['PASS'])
  const state = replaceRow(
    { lines: [], rows: [list] },
    { ...list, value: ['PASS', 'q10'] },
  )
  expect(writeFilterRows(state)).toEqual([
    "jexl:feature.FILTER in ['PASS', 'q10']",
  ])
  expect(withOp(list, '~').value).toBe('PASS')
})

test('flags and typed fields', () => {
  const flag = withField(
    { kind: 'condition', id: 0, op: '==', value: '' },
    choices[2]!,
  )
  const typed = withField(
    { kind: 'condition', id: 1, op: '==', value: '' },
    typedField('INFO.CLNSIG'),
  )
  expect(
    writeFilterRows({
      lines: [],
      rows: [
        { ...flag, op: '!set' },
        { ...typed, op: '~', value: '(?i)pathogenic' },
      ],
    }),
  ).toEqual([
    'jexl:!feature.INFO.DB',
    "jexl:feature.INFO.CLNSIG ~ '(?i)pathogenic'",
  ])
})

test('a number field drops a value that is not a number', () => {
  const qual = withField(
    { kind: 'condition', id: 0, op: '==', value: '' },
    choices[0]!,
  )
  expect(
    writeFilterRows({ lines: [], rows: [{ ...qual, value: 'abc' }] }),
  ).toEqual([])
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
