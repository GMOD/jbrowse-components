import {
  cellColorOfField,
  fieldRefOf,
  parseCuts,
} from './cellColorFieldDialogUtil.ts'

test('a header field is a path, a variant function a jexl call', () => {
  expect(
    fieldRefOf({ label: 'CLNSIG', path: ['INFO', 'CLNSIG'], type: 'text' }),
  ).toBe('INFO.CLNSIG')
  expect(fieldRefOf({ label: 'maf', call: 'maf', type: 'number' })).toBe(
    'jexl:maf(feature)',
  )
})

test('cut points parse commas or spaces, ascending', () => {
  expect(parseCuts('')).toEqual([])
  expect(parseCuts('0.05, 0.001 0.01')).toEqual([0.001, 0.01, 0.05])
  expect(parseCuts('0.01, rare')).toBeUndefined()
})

test('cuts make a threshold, none a colour per value', () => {
  expect(cellColorOfField('INFO.CLNSIG', [])).toEqual({ field: 'INFO.CLNSIG' })
  expect(cellColorOfField('INFO.AF', [0.001, 0.01])).toEqual({
    field: 'INFO.AF',
    scale: 'threshold',
    domain: ['0.001', '0.01'],
  })
})
