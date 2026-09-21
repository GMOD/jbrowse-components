import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'

import type { GridBookmarkModel } from './GridBookmarkWidget/model.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export function activateHighlightWidget(node: IAnyStateTreeNode) {
  const session = getSession(node)
  if (isSessionModelWithWidgets(session)) {
    return session.openWidget(
      'GridBookmarkWidget',
      'GridBookmark',
    ) as GridBookmarkModel
  }
  throw new Error('Could not open the highlight list')
}
