import { getSession } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

export function getTag(
  tag: string,
  feat: {
    tags?: Record<string, unknown>
    [key: string]: unknown
  },
) {
  return feat.tags?.[tag] || feat[tag]
}

export async function navToLoc(locString: string, model: IAnyStateTreeNode) {
  const session = getSession(model)
  const { view } = model
  try {
    if (view) {
      await view.navToLocString(locString)
    } else {
      throw new Error('No view associated with this view anymore')
    }
  } catch (e) {
    console.error(e)
    session.notify(`${e}`)
  }
}
