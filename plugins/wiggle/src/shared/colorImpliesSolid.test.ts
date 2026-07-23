import { colorImpliesSolid } from './colorImpliesSolid.ts'

test('a bare color turns bicolor off', () => {
  expect(colorImpliesSolid({ color: 'green' })).toEqual({
    color: 'green',
    useBicolor: false,
  })
})

test('an explicit useBicolor wins', () => {
  const snap = { color: 'green', useBicolor: true }
  expect(colorImpliesSolid(snap)).toBe(snap)
})

test('posColor/negColor mean bicolor was intended', () => {
  const snap = { color: 'green', posColor: 'red' }
  expect(colorImpliesSolid(snap)).toBe(snap)
})

test('no color is left alone', () => {
  const snap = { scaleType: 'log' }
  expect(colorImpliesSolid(snap)).toBe(snap)
})
