import { getSession } from '@jbrowse/core/util'
import { isTextEntryFocused } from '@jbrowse/core/util/isTextEntryFocused'
import { addDisposer } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from './model.ts'
import type { KeyboardShortcut } from '@jbrowse/core/pluggableElementTypes'

interface LgvShortcut extends KeyboardShortcut {
  code: string
  shift?: boolean
  run: (self: LinearGenomeViewModel) => void
}

// every entry also needs Ctrl or Cmd; an arrow fires with or without Shift
export const lgvKeyboardShortcuts: readonly LgvShortcut[] = [
  {
    keys: 'Ctrl/Cmd + ←',
    description: 'Pan left',
    code: 'ArrowLeft',
    run: self => {
      self.slide(-0.9)
    },
  },
  {
    keys: 'Ctrl/Cmd + →',
    description: 'Pan right',
    code: 'ArrowRight',
    run: self => {
      self.slide(0.9)
    },
  },
  {
    keys: 'Ctrl/Cmd + ↑',
    description: 'Zoom in',
    code: 'ArrowUp',
    run: self => {
      self.zoom(self.bpPerPx / 2)
    },
  },
  {
    keys: 'Ctrl/Cmd + ↓',
    description: 'Zoom out',
    code: 'ArrowDown',
    run: self => {
      self.zoom(self.bpPerPx * 2)
    },
  },
  {
    keys: 'Ctrl/Cmd + Shift + D',
    description: 'Highlight the region in view',
    code: 'KeyD',
    shift: true,
    run: self => {
      self.highlightCurrentRegion()
      getSession(self).notify('Region highlighted.', 'success')
    },
  },
  {
    keys: 'Ctrl/Cmd + Shift + M',
    description: 'Go to the newest highlight',
    code: 'KeyM',
    shift: true,
    run: self => {
      void self.navigateNewestHighlight()
    },
  },
]

export function setupKeyboardHandler(self: LinearGenomeViewModel) {
  if (typeof document === 'undefined') {
    return
  }
  function handler(e: KeyboardEvent) {
    if (
      getSession(self).focusedViewId === self.id &&
      (e.ctrlKey || e.metaKey) &&
      !isTextEntryFocused()
    ) {
      const shortcut = lgvKeyboardShortcuts.find(
        s => s.code === e.code && (!s.shift || e.shiftKey),
      )
      if (shortcut) {
        e.preventDefault()
        shortcut.run(self)
      }
    }
  }
  document.addEventListener('keydown', handler)
  addDisposer(self, () => {
    document.removeEventListener('keydown', handler)
  })
}
