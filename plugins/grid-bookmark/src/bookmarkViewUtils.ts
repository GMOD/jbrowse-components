import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'

import type { GridBookmarkModel } from './GridBookmarkWidget/model.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// get-or-create the singleton highlight list widget and bring it to front
export function activateHighlightWidget(node: IAnyStateTreeNode) {
  const session = getSession(node)
  if (isSessionModelWithWidgets(session)) {
    let widget = session.widgets.get('GridBookmark')
    widget ??= session.addWidget('GridBookmarkWidget', 'GridBookmark')
    session.showWidget(widget)
    return widget as GridBookmarkModel
  }
  throw new Error('Could not open the highlight list')
}
