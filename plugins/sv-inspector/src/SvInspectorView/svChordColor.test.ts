import { chordColorForType } from './svChordColor.ts'

test('a class swatch is its class color at the chords’ alpha', () => {
  expect(chordColorForType('DEL')).toMatch(/^rgba\(228, 26, 28, 0\.45/)
  expect(chordColorForType('DUP')).not.toBe(chordColorForType('DEL'))
})
