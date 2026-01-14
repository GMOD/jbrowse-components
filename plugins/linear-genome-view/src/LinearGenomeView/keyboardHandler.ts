import { getSession } from '@jbrowse/core/util'
import { addDisposer } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from './model.ts'

/**
 * Sets up keyboard shortcuts for the LinearGenomeView
 * - Ctrl/Cmd + ArrowLeft: slide left
 * - Ctrl/Cmd + ArrowRight: slide right
 * - Ctrl/Cmd + ArrowUp: zoom in
 * - Ctrl/Cmd + ArrowDown: zoom out
 */
export function setupKeyboardHandler(self: LinearGenomeViewModel) {
  function handler(e: KeyboardEvent) {
    const session = getSession(self)
    if (session.focusedViewId === self.id && (e.ctrlKey || e.metaKey)) {
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
      }
    }
  }
  document.addEventListener('keydown', handler)
  addDisposer(self, () => {
    document.removeEventListener('keydown', handler)
  })
}
