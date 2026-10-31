import { trackFields } from './fields.ts'

function colorStep(value: unknown, displayType: string) {
  const step = trackFields['encoding.color']!(value, { noun: 'feature', displayType })
  return Array.isArray(step) ? undefined : step
}

test('a declared range sends a canvas color to Edit plot', () => {
  expect(
    colorStep(
      { field: 'biotype', scale: { range: ['red'] } },
      'LinearBasicDisplay',
    )?.path,
  ).toBe('Track menu → Advanced → Edit plot...')
})

test('a constant is the value member, and a bare string names the field', () => {
  expect(colorStep({ value: 'red' }, 'LinearBasicDisplay')?.path).toBe(
    'Track menu → Color by → Solid color... → red',
  )
  expect(colorStep('biotype', 'LinearBasicDisplay')?.path).toBe(
    'Track menu → Color by → Attribute... → biotype',
  )
  expect(colorStep('impact', 'LinearVariantDisplay')?.path).toBe(
    'Track menu → Color by → Cells → Consequence impact',
  )
})

test('a Hi-C scale names the scheme and the log toggle', () => {
  expect(
    colorStep({ scale: { type: 'log', scheme: 'viridis' } }, 'LinearHicDisplay'),
  ).toEqual({
    path: 'Track menu → Color scheme → Log scale (checked)',
    note: 'Then Track menu → Color scheme → Viridis.',
  })
})

test('a wiggle cut at one point is the two plot swatches', () => {
  expect(
    colorStep(
      { scale: { type: 'threshold', domain: [0], range: ['blue', 'red'] } },
      'LinearWiggleDisplay',
    )?.path,
  ).toBe('Track menu → Edit colors/arrangement... → the plot color swatches')
})
