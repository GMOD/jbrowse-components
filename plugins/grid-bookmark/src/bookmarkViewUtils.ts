import {
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
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

interface HighlightToggleable {
  bookmarkHighlightsVisible: boolean
  highlightsVisible: boolean
  setBookmarkHighlightsVisible: (arg: boolean) => void
  setHighlightsVisible: (arg: boolean) => void
}

// single checkbox that flips both bookmark-highlight and view.highlight
// visibility together; checked when either kind is visible
export function toggleHighlightsMenuItem(self: HighlightToggleable): MenuItem {
  return {
    label: 'Toggle highlights',
    icon: HighlightIcon,
    type: 'checkbox',
    checked: self.bookmarkHighlightsVisible || self.highlightsVisible,
    onClick: () => {
      const next = !(self.bookmarkHighlightsVisible || self.highlightsVisible)
      self.setBookmarkHighlightsVisible(next)
      self.setHighlightsVisible(next)
    },
  }
}
