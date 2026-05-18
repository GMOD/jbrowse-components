import { getEnv, getSession } from '@jbrowse/core/util'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export function getTag(
  tag: string,
  feat: {
    tags?: Record<string, unknown>
    [key: string]: unknown
  },
) {
  return feat.tags?.[tag] ?? feat[tag]
}

export function hasBreakpointSplitView(model: IAnyStateTreeNode) {
  try {
    return !!getEnv(getSession(model)).pluginManager.getViewType(
      'BreakpointSplitView',
    )
  } catch {
    return false
  }
}

export function navToLoc(locString: string, model: IAnyStateTreeNode) {
  const session = getSession(model)
  const { view } = model
  if (view) {
    view.navToLocString(locString).catch((e: unknown) => {
      console.error(e)
      session.notify(`${e}`)
    })
  } else {
    session.notify('No view associated with this view anymore')
  }
}
