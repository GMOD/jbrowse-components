import { getEnv, getSession } from '@jbrowse/core/util'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface AlignmentFeatureSerialized extends SimpleFeatureSerialized {
  flags?: number
  CIGAR?: string
  next_ref?: string
  next_pos?: number
  tags?: Record<string, unknown>
}

export function getTag(tag: string, feat: AlignmentFeatureSerialized) {
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
