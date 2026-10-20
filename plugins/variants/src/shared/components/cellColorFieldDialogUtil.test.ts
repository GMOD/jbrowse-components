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

test('cuts make a threshold, none a color per value', () => {
  expect(cellColorOfField({}, 'INFO.CLNSIG', [])).toEqual({
    field: 'INFO.CLNSIG',
  })
  expect(cellColorOfField({}, 'INFO.AF', [0.001, 0.01])).toEqual({
    field: 'INFO.AF',
    scale: 'threshold',
    domain: ['0.001', '0.01'],
  })
})

test('new cuts on the field already painting keep its key and parked color', () => {
  const current = {
    value: 'teal',
    field: 'INFO.AF',
    scale: 'threshold',
    domain: ['0.01'],
    range: ['grey', 'red'],
    labels: ['rare', 'common'],
    title: 'Frequency',
    unknown: '#ccc',
  }
  expect(cellColorOfField(current, 'INFO.AF', [0.05])).toEqual({
    ...current,
    domain: ['0.05'],
  })
  const { range: _range, ...withoutRange } = current
  expect(cellColorOfField(current, 'INFO.AF', [0.001, 0.05])).toEqual({
    ...withoutRange,
    domain: ['0.001', '0.05'],
  })
  const { scale: _scale, domain: _domain, ...perValue } = withoutRange
  expect(cellColorOfField(current, 'INFO.AF', [])).toEqual(perValue)
  expect(cellColorOfField(current, 'INFO.DP', [])).toEqual({
    value: 'teal',
    field: 'INFO.DP',
  })
})
