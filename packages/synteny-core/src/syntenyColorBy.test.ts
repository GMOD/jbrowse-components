import { paintedField, syntenyColorFor } from './syntenyColorBy.ts'

test('a channel naming no field paints none, the slot default "" included', () => {
  expect(paintedField({})).toBeUndefined()
  expect(paintedField({ field: '' })).toBeUndefined()
  expect(paintedField({ value: 'grey' })).toBeUndefined()
  expect(paintedField({ field: 'strand' })).toBe('strand')
})

test('syntenyColorFor(undefined) clears the field and keeps the constant', () => {
  expect(
    syntenyColorFor(undefined, {
      value: 'grey',
      field: 'gene_group',
      scale: { domain: ['B1'] },
    }),
  ).toEqual({ value: 'grey' })
  expect(syntenyColorFor(undefined, { field: 'strand' })).toEqual({})
  expect(syntenyColorFor('strand', {})).toEqual({ field: 'strand' })
})
