/**
 * Whether the user is typing into a text field, for a document-level shortcut
 * that must leave that field's own keys alone: ctrl+z undoing typing rather
 * than the session, ctrl+arrow moving the caret rather than the view. A
 * `<textarea>` counts, which the multiline config and JSON editors render.
 */
export function isTextEntryFocused() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const tag = el.tagName.toUpperCase()
  // coerced: isContentEditable is declared boolean but is undefined in jsdom,
  // so the raw expression returns undefined for an ordinary focused element
  return tag === 'INPUT' || tag === 'TEXTAREA' || !!el.isContentEditable
}
