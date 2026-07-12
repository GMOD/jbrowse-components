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

interface HighlightToggleableView {
  highlightsVisible: boolean
  showHighlightChips: boolean
  setHighlightsVisible: (arg: boolean) => void
  setShowHighlightChips: (arg: boolean) => void
}

// bookmark-highlight visibility now lives on the widget (one global toggle),
// while view.highlight visibility stays per-view
function getExistingBookmarkWidget(node: IAnyStateTreeNode) {
  const session = getSession(node)
  return isSessionModelWithWidgets(session)
    ? (session.widgets.get('GridBookmark') as GridBookmarkModel | undefined)
    : undefined
}

// single checkbox that flips both bookmark-highlight (widget) and view.highlight
// visibility together; checked when either kind is visible
export function toggleHighlightsMenuItem(
  self: IAnyStateTreeNode & HighlightToggleableView,
): MenuItem {
  const widget = getExistingBookmarkWidget(self)
  const anyOn = !!widget?.bookmarkHighlightsVisible || self.highlightsVisible
  return {
    label: 'Toggle highlights',
    icon: HighlightIcon,
    type: 'checkbox',
    checked: anyOn,
    onClick: () => {
      widget?.setBookmarkHighlightsVisible(!anyOn)
      self.setHighlightsVisible(!anyOn)
    },
  }
}

// single checkbox for the interactive chip (link icon + context menu) drawn on
// each band. Disabled while no highlights are visible
export function toggleHighlightChipsMenuItem(
  self: IAnyStateTreeNode & HighlightToggleableView,
): MenuItem {
  const widget = getExistingBookmarkWidget(self)
  const anyOn = !!widget?.bookmarkHighlightsVisible || self.highlightsVisible
  return {
    label: 'Show highlight chips',
    icon: HighlightIcon,
    type: 'checkbox',
    checked: self.showHighlightChips,
    disabled: !anyOn,
    onClick: () => {
      self.setShowHighlightChips(!self.showHighlightChips)
    },
  }
}
