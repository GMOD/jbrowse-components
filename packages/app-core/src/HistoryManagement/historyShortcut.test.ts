import { historyShortcut } from './index.ts'

function press(
  key: string,
  code: string,
  mods: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {},
) {
  return historyShortcut({
    key,
    code,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
  })
}

test('US layout', () => {
  expect(press('z', 'KeyZ', { ctrl: true })).toBe('undo')
  expect(press('z', 'KeyZ', { meta: true })).toBe('undo')
  expect(press('Z', 'KeyZ', { ctrl: true, shift: true })).toBe('redo')
  expect(press('y', 'KeyY', { ctrl: true })).toBe('redo')
  expect(press('z', 'KeyZ')).toBeUndefined()
})

test('the letter decides, not the key position', () => {
  // German QWERTZ: Z sits where US has Y
  expect(press('z', 'KeyY', { ctrl: true })).toBe('undo')
  expect(press('y', 'KeyZ', { ctrl: true })).toBe('redo')
  // French AZERTY: Z sits where US has W
  expect(press('z', 'KeyW', { ctrl: true })).toBe('undo')
})

test('a non-Latin layout falls back to the key position', () => {
  expect(press('я', 'KeyZ', { ctrl: true })).toBe('undo')
  expect(press('н', 'KeyY', { ctrl: true })).toBe('redo')
})
