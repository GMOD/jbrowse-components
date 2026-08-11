import fs from 'node:fs'
import path from 'node:path'

import { parseSTARFusionBuffer } from './STARFusionImport.ts'

const enc = (s: string) => new TextEncoder().encode(s)

const body = 'A--B\tchr1:100:+\tchr2:200:-\n' as const

test('starfusion import', () => {
  const filepath = path.join(
    __dirname,
    '..',
    'test_data',
    'starfusion_example.fusion_predictions.tsv',
  )
  expect(parseSTARFusionBuffer(fs.readFileSync(filepath))).toMatchSnapshot()
})

// Regression: the leading `#` was sliced off whether or not it was there, so a
// header without one lost the first character of its first column name
test('a header with no leading # keeps its first column name', () => {
  const withHash = parseSTARFusionBuffer(
    enc(`#FusionName\tLeftBreakpoint\tRightBreakpoint\n${body}`),
  )
  const without = parseSTARFusionBuffer(
    enc(`FusionName\tLeftBreakpoint\tRightBreakpoint\n${body}`),
  )
  expect(without.columns.map(c => c.name)).toEqual(
    withHash.columns.map(c => c.name),
  )
  expect(without.columns[0]!.name).toBe('FusionName')
})

// Regression: picking the wrong File Type in the import form failed on the
// first row with a bare "Cannot read properties of undefined (reading
// 'split')", naming neither the missing column nor the bad guess
test('a file without the breakpoint columns says so', () => {
  expect(() =>
    parseSTARFusionBuffer(enc('#chrom\tstart\tend\nchr1\t100\t200\n')),
  ).toThrow(/no LeftBreakpoint or RightBreakpoint column/)
})
