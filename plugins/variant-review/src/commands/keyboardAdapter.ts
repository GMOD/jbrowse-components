import { isTextEntryFocused } from '@jbrowse/core/util/isTextEntryFocused'

import { keyNameOf } from './keymap.ts'
import { getReviewCommand } from './registry.ts'

import type { ReviewCommandId } from './registry.ts'

// MUI menus type-ahead on letter keys, and a listbox or dialog owns its keys:
// a bare `a` belongs to them while one has focus
const KEY_OWNING_CONTAINERS =
  '[role="menu"],[role="listbox"],[role="dialog"],[role="combobox"]'

// Space and Enter activate a focused control; taking them would swallow a
// button press
const ACTIVATABLE =
  'button,a[href],summary,[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="tab"]'

function activeElement() {
  return typeof document === 'undefined'
    ? undefined
    : (document.activeElement ?? undefined)
}

/**
 * Whether a keydown may be read as a review command at all. The bare-letter
 * shortcuts are the first in the app, so they have to keep out of the way of
 * everything that already reads letters.
 */
export function keyEventEligible(e: KeyboardEvent) {
  if (
    e.defaultPrevented ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.isComposing ||
    e.key === 'Process' ||
    isTextEntryFocused()
  ) {
    return false
  }
  const el = activeElement()
  if (el?.closest(KEY_OWNING_CONTAINERS)) {
    return false
  }
  if ((e.key === ' ' || e.key === 'Enter') && el?.closest(ACTIVATABLE)) {
    return false
  }
  return true
}

/**
 * The document `keydown` listener for one reviewing view. It maps an eligible
 * event to a command and hands it to `run`, which answers whether a command
 * actually ran; only then is the event's default prevented, so Space still
 * scrolls the page when review is off or the guard declines.
 */
export function createReviewKeyHandler({
  isActive,
  bindings,
  run,
}: {
  // this view is focused and reviewing
  isActive: () => boolean
  bindings: () => ReadonlyMap<string, ReviewCommandId>
  run: (id: ReviewCommandId) => boolean
}) {
  return (e: KeyboardEvent) => {
    if (!isActive() || !keyEventEligible(e)) {
      return
    }
    const id = bindings().get(keyNameOf(e))
    if (id === undefined || (e.repeat && !getReviewCommand(id).repeatable)) {
      return
    }
    if (run(id)) {
      e.preventDefault()
    }
  }
}
