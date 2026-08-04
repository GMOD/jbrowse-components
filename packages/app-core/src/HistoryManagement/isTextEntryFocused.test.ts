import { isTextEntryFocused } from './index.ts'

// The undo/redo keydown listener sits on `document`, so it competes with every
// text field in the app for ctrl+z. Anything with its own undo stack has to win.
function focus(html: string) {
  document.body.innerHTML = html
  const el = document.body.firstElementChild
  if (!(el instanceof HTMLElement)) {
    throw new Error('no element to focus')
  }
  el.focus()
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

test('nothing focused defers to session undo', () => {
  expect(isTextEntryFocused()).toBe(false)
  focus('<div tabindex="0"></div>')
  expect(isTextEntryFocused()).toBe(false)
})

test('a text input keeps its own undo', () => {
  focus('<input type="text" />')
  expect(isTextEntryFocused()).toBe(true)
})

// the regression this exists for: MUI's `multiline` TextField renders a
// <textarea>, which the old INPUT-only check missed — so ctrl+z while editing a
// config slot, a jexl callback, or a pasted config rolled back the session
test('a textarea keeps its own undo', () => {
  focus('<textarea></textarea>')
  expect(isTextEntryFocused()).toBe(true)
})

test('a contenteditable keeps its own undo', () => {
  const el = focus('<div contenteditable="true"></div>')
  // jsdom does not implement isContentEditable off the attribute
  Object.defineProperty(el, 'isContentEditable', { value: true })
  expect(isTextEntryFocused()).toBe(true)
})
