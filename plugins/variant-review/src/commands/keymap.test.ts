import { DEFAULT_REVIEW_KEYMAP, keyNameOf, resolveKeymap } from './keymap.ts'

test('defaults resolve with no problems', () => {
  const { bindings, problems } = resolveKeymap()
  expect(problems).toEqual([])
  expect(bindings.get('j')).toBe('next')
  expect(bindings.get('Space')).toBe('details')
  expect(bindings.get('Enter')).toBe('restoreViewport')
  expect(bindings.size).toBe(Object.keys(DEFAULT_REVIEW_KEYMAP).length)
})

test('overrides replace defaults and are normalized', () => {
  const { bindings, problems } = resolveKeymap({ next: 'L', previous: 'h' })
  expect(problems).toEqual([])
  expect(bindings.get('l')).toBe('next')
  expect(bindings.get('h')).toBe('previous')
  expect(bindings.has('j')).toBe(false)
})

test('duplicates and unknown commands are reported; the first claim wins', () => {
  const { bindings, problems } = resolveKeymap({ accept: 'j', bogus: 'x' })
  expect(problems).toHaveLength(2)
  expect(problems.join('; ')).toMatch(/unknown review command "bogus"/)
  expect(problems.join('; ')).toMatch(/"j" is bound to both next and accept/)
  expect(bindings.get('j')).toBe('next')
})

test('an empty binding unbinds', () => {
  const { bindings } = resolveKeymap({ details: '' })
  expect(bindings.has('Space')).toBe(false)
})

test('keyNameOf', () => {
  expect(keyNameOf({ key: 'j', shiftKey: false })).toBe('j')
  expect(keyNameOf({ key: 'J', shiftKey: true })).toBe('Shift+j')
  expect(keyNameOf({ key: ' ', shiftKey: false })).toBe('Space')
  expect(keyNameOf({ key: 'Enter', shiftKey: true })).toBe('Shift+Enter')
  // a shifted punctuation key is the character it types
  expect(keyNameOf({ key: '{', shiftKey: true })).toBe('{')
  expect(resolveKeymap({ next: 'Shift+J' }).bindings.get('Shift+j')).toBe(
    'next',
  )
})
