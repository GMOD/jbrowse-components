import { createReviewKeyHandler } from './keyboardAdapter.ts'
import { resolveKeymap } from './keymap.ts'

import type { ReviewCommandId } from './registry.ts'

function setup(opts?: { active?: boolean; runs?: boolean }) {
  const ran: ReviewCommandId[] = []
  const { bindings } = resolveKeymap()
  const handler = createReviewKeyHandler({
    isActive: () => opts?.active ?? true,
    bindings: () => bindings,
    run: id => {
      ran.push(id)
      return opts?.runs ?? true
    },
  })
  return { ran, handler }
}

function key(k: string, init?: KeyboardEventInit) {
  return new KeyboardEvent('keydown', { key: k, cancelable: true, ...init })
}

afterEach(() => {
  ;(document.activeElement as HTMLElement | null)?.blur()
  document.body.replaceChildren()
})

test('a bound key dispatches and prevents default', () => {
  const { ran, handler } = setup()
  const e = key('j')
  handler(e)
  expect(ran).toEqual(['next'])
  expect(e.defaultPrevented).toBe(true)
})

test('matches e.key, not e.code: the key labelled j on any layout', () => {
  const { ran, handler } = setup()
  // Dvorak: the physical KeyC types `j`
  handler(key('j', { code: 'KeyC' }))
  // QWERTY KeyJ under a layout where it types something unbound
  handler(key('h', { code: 'KeyJ' }))
  expect(ran).toEqual(['next'])
})

test('preventDefault only when a command actually ran', () => {
  const { handler } = setup({ runs: false })
  const e = key(' ')
  handler(e)
  expect(e.defaultPrevented).toBe(false)
})

test('an unbound key does nothing', () => {
  const { ran, handler } = setup()
  const e = key('x')
  handler(e)
  expect(ran).toEqual([])
  expect(e.defaultPrevented).toBe(false)
})

test('inactive (unfocused view or review off) does nothing', () => {
  const { ran, handler } = setup({ active: false })
  handler(key('j'))
  expect(ran).toEqual([])
})

test.each([
  ['ctrlKey', { ctrlKey: true }],
  ['metaKey', { metaKey: true }],
  ['altKey', { altKey: true }],
  ['isComposing', { isComposing: true }],
])('%s suppresses', (_label, init) => {
  const { ran, handler } = setup()
  handler(key('a', init))
  expect(ran).toEqual([])
})

test('IME Process key suppresses', () => {
  const { ran, handler } = setup()
  handler(key('Process'))
  expect(ran).toEqual([])
})

test('defaultPrevented suppresses', () => {
  const { ran, handler } = setup()
  const e = key('j')
  e.preventDefault()
  handler(e)
  expect(ran).toEqual([])
})

test('repeat suppresses decisions but not navigation', () => {
  const { ran, handler } = setup()
  handler(key('a', { repeat: true }))
  handler(key('j', { repeat: true }))
  expect(ran).toEqual(['next'])
})

test.each(['input', 'textarea'])('focused %s suppresses', tag => {
  const { ran, handler } = setup()
  const el = document.createElement(tag)
  document.body.append(el)
  el.focus()
  handler(key('a'))
  expect(ran).toEqual([])
})

test.each(['menu', 'listbox', 'dialog', 'combobox'])(
  'focus inside role=%s suppresses',
  role => {
    const { ran, handler } = setup()
    const container = document.createElement('div')
    container.setAttribute('role', role)
    const item = document.createElement('div')
    item.tabIndex = 0
    container.append(item)
    document.body.append(container)
    item.focus()
    handler(key('a'))
    expect(ran).toEqual([])
  },
)

test('Space and Enter on a focused button are left to the button', () => {
  const { ran, handler } = setup()
  const button = document.createElement('button')
  document.body.append(button)
  button.focus()
  const space = key(' ')
  handler(space)
  handler(key('Enter'))
  expect(ran).toEqual([])
  expect(space.defaultPrevented).toBe(false)
  // a letter still works there
  handler(key('j'))
  expect(ran).toEqual(['next'])
})
