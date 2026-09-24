import { getSession } from '@jbrowse/core/util'
import { isTextEntryFocused } from '@jbrowse/core/util/isTextEntryFocused'
import { addDisposer } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from './model.ts'

/**
 * Sets up keyboard shortcuts for the LinearGenomeView
 * - Ctrl/Cmd + ArrowLeft: slide left
 * - Ctrl/Cmd + ArrowRight: slide right
 * - Ctrl/Cmd + ArrowUp: zoom in
 * - Ctrl/Cmd + ArrowDown: zoom out
 * - Ctrl/Cmd + Shift + D: highlight the region in view
 * - Ctrl/Cmd + Shift + M: go to the newest highlight
 */
export function setupKeyboardHandler(self: LinearGenomeViewModel) {
  if (typeof document === 'undefined') {
    return
  }
  function handler(e: KeyboardEvent) {
    const session = getSession(self)
    if (
      session.focusedViewId === self.id &&
      (e.ctrlKey || e.metaKey) &&
      !isTextEntryFocused()
    ) {
      if (e.code === 'ArrowLeft') {
        e.preventDefault()
        self.slide(-0.9)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        self.slide(0.9)
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        self.zoom(self.bpPerPx / 2)
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        self.zoom(self.bpPerPx * 2)
      } else if (e.shiftKey && e.code === 'KeyD') {
        e.preventDefault()
        self.highlightCurrentRegion()
        session.notify('Region highlighted.', 'success')
      } else if (e.shiftKey && e.code === 'KeyM') {
        e.preventDefault()
        void self.navigateNewestHighlight()
      }
    }
  }
  document.addEventListener('keydown', handler)
  addDisposer(self, () => {
    document.removeEventListener('keydown', handler)
  })
}
