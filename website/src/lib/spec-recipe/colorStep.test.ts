import { trackFields } from './fields.ts'

function colorStep(value: unknown, displayType: string) {
  const step = trackFields.color!(value, { noun: 'feature', displayType })
  return Array.isArray(step) ? undefined : step
}

test('a declared range sends a canvas color to Edit plot', () => {
  expect(
    colorStep({ field: 'biotype', range: ['red'] }, 'LinearBasicDisplay')?.path,
  ).toBe('Track menu → Advanced → Edit plot...')
})
