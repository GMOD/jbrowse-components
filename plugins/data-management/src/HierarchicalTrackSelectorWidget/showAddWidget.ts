import { isSessionModelWithWidgets } from '@jbrowse/core/util'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export function showAddTrackWidget(
  session: IStateTreeNode,
  viewId: string | undefined,
  trackContainerId?: string,
) {
  if (isSessionModelWithWidgets(session)) {
    session.openWidget('AddTrackWidget', 'addTrackWidget', {
      view: viewId,
      trackContainerId,
    })
  }
}

export function showAddConnectionWidget(session: IStateTreeNode) {
  if (isSessionModelWithWidgets(session)) {
    session.openWidget('AddConnectionWidget', 'addConnectionWidget')
  }
}
