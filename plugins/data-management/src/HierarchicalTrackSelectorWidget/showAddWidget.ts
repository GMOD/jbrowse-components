import { isSessionModelWithWidgets } from '@jbrowse/core/util'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// "Add track" and "Add connection" are offered from two places, the hamburger
// menu and the corner FAB, and both need the same widget dance

export function showAddTrackWidget(
  session: IStateTreeNode,
  viewId: string,
  trackContainerId?: string,
) {
  if (isSessionModelWithWidgets(session)) {
    session.showWidget(
      session.addWidget('AddTrackWidget', 'addTrackWidget', {
        view: viewId,
        trackContainerId,
      }),
    )
  }
}

export function showAddConnectionWidget(session: IStateTreeNode) {
  if (isSessionModelWithWidgets(session)) {
    session.showWidget(
      session.addWidget('AddConnectionWidget', 'addConnectionWidget'),
    )
  }
}
