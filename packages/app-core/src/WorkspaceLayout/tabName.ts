import { viewName } from '../ui/App/viewTitle.ts'

import type { TabNode } from './tree.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'

/** A tab's name: the user's title if it has one, else derived from its views */
export function tabDisplayName(
  tab: TabNode,
  views: AbstractViewModel[],
  session: { assemblyManager: { getDisplayName: (name: string) => string } },
) {
  if (tab.title) {
    return tab.title
  }
  if (views.length === 0) {
    return 'Empty'
  }
  if (views.length === 1) {
    return viewName(views[0]!, r => session.assemblyManager.getDisplayName(r))
  }
  return `${views.length} views`
}
