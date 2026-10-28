import { shortcutFor } from './devToolsShortcuts.ts'

import type { Input } from 'electron'

jest.mock('electron', () => ({ app: { on: jest.fn() } }))

const isMac = process.platform === 'darwin'

function key(overrides: Partial<Input>) {
  return {
    type: 'keyDown',
    key: '',
    code: '',
    shift: false,
    alt: false,
    meta: false,
    control: false,
    ...overrides,
  } as Input
}

const command = isMac ? { meta: true } : { control: true }

test('a packaged build opens DevTools but does not reload', () => {
  expect(shortcutFor(key({ key: 'F12' }), true)).toBe('toggleDevTools')
  expect(
    shortcutFor(
      key({
        key: 'I',
        code: 'KeyI',
        ...command,
        ...(isMac ? { alt: true } : { shift: true }),
      }),
      true,
    ),
  ).toBe('toggleDevTools')
  expect(shortcutFor(key({ key: 'F5' }), true)).toBeUndefined()
  expect(
    shortcutFor(key({ key: 'r', code: 'KeyR', ...command }), true),
  ).toBeUndefined()
})

test('a development build reloads on F5 and Ctrl/Cmd+R', () => {
  expect(shortcutFor(key({ key: 'F5' }), false)).toBe('reload')
  expect(shortcutFor(key({ key: 'r', code: 'KeyR', ...command }), false)).toBe(
    'reload',
  )
})

test('a key release and a plain letter are not shortcuts', () => {
  expect(shortcutFor(key({ key: 'F12', type: 'keyUp' }), true)).toBeUndefined()
  expect(shortcutFor(key({ key: 'i', code: 'KeyI' }), true)).toBeUndefined()
})
