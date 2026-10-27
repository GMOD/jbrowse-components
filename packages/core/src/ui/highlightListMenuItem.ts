import { getEnv, getSession } from '../util/mstUtils.ts'
import { isSessionModelWithWidgets } from '../util/types/index.ts'

import type { MenuItem } from './MenuTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/** #menuBuilder highlightListMenuItems | "Open highlight list", or nothing in a product without the widget */
export function highlightListMenuItems(node: IAnyStateTreeNode): MenuItem[] {
  const session = getSession(node)
  return isSessionModelWithWidgets(session) &&
    getEnv(node).pluginManager.widgetTypes.has('GridBookmarkWidget')
    ? [
        {
          label: 'Open highlight list',
          onClick: () => {
            session.openWidget('GridBookmarkWidget', 'GridBookmark')
          },
        },
      ]
    : []
}
