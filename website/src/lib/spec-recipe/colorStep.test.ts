import { trackFields } from './fields.ts'

function colorStep(value: unknown, displayType: string) {
  const step = trackFields.color!(value, { noun: 'feature', displayType })
  return Array.isArray(step) ? undefined : step
}

test('a declared range sends a canvas colour to the Edit as JSON box', () => {
  expect(
    colorStep({ field: 'biotype', range: ['red'] }, 'LinearBasicDisplay')?.path,
  ).toBe('Track menu → Color by... → Attribute... → Edit as JSON...')
})
