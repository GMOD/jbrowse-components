import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import HighlightIcon from '@mui/icons-material/Highlight'

import type { GridBookmarkModel } from './GridBookmarkWidget/model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// get-or-create the singleton GridBookmark widget and bring it to front
export function activateBookmarkWidget(node: IAnyStateTreeNode) {
  const session = getSession(node)
  if (isSessionModelWithWidgets(session)) {
    let widget = session.widgets.get('GridBookmark')
    widget ??= session.addWidget('GridBookmarkWidget', 'GridBookmark')
    session.showWidget(widget)
    return widget as GridBookmarkModel
  }
  throw new Error('Could not open bookmark widget')
}

// ensure the widget exists (without showing it) so its localStorage-backed
// bookmarks can render as highlight overlays without each overlay component
// having to create it on first render
export function ensureBookmarkWidget(node: IAnyStateTreeNode) {
  const session = getSession(node)
  if (
    isSessionModelWithWidgets(session) &&
    !session.widgets.get('GridBookmark')
  ) {
    session.addWidget('GridBookmarkWidget', 'GridBookmark')
  }
}

interface ChipToggleableView {
  showHighlightChips: boolean
  setShowHighlightChips: (arg: boolean) => void
}

// bookmark-highlight visibility is a single session-level flag added by this
// plugin's Core-extendSession, shared by every view's overlays
export interface SessionWithBookmarkHighlights {
  bookmarkHighlightsVisible: boolean
  setBookmarkHighlightsVisible: (arg: boolean) => void
}

export function getBookmarkSession(node: IAnyStateTreeNode) {
  return getSession(node) as ReturnType<typeof getSession> &
    SessionWithBookmarkHighlights
}

// single checkbox for the one session-level highlight-visibility flag
export function toggleHighlightsMenuItem(self: IAnyStateTreeNode): MenuItem {
  const session = getBookmarkSession(self)
  return {
    label: 'Toggle highlights',
    icon: HighlightIcon,
    type: 'checkbox',
    checked: session.bookmarkHighlightsVisible,
    onClick: () => {
      session.setBookmarkHighlightsVisible(!session.bookmarkHighlightsVisible)
    },
  }
}

// single checkbox for the interactive chip (link icon + context menu) drawn on
// each band. Disabled while highlights are hidden
export function toggleHighlightChipsMenuItem(
  self: IAnyStateTreeNode & ChipToggleableView,
): MenuItem {
  const session = getBookmarkSession(self)
  return {
    label: 'Show highlight chips',
    icon: HighlightIcon,
    type: 'checkbox',
    checked: self.showHighlightChips,
    disabled: !session.bookmarkHighlightsVisible,
    onClick: () => {
      self.setShowHighlightChips(!self.showHighlightChips)
    },
  }
}
