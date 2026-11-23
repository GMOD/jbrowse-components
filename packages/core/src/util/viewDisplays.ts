import { hasParent, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { getContainingView } from './mstUtils.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

function displaysOf(track: unknown): unknown[] {
  return typeof track === 'object' &&
    track !== null &&
    'displays' in track &&
    Array.isArray(track.displays)
    ? track.displays
    : []
}

function containingView(node: IAnyStateTreeNode): object | undefined {
  if (isStateTreeNode(node) && hasParent(node)) {
    try {
      return getContainingView(node)
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Every display of every track in `node`'s view, in track order, `node`
 * among them: none for a node standing in no view, as a unit test or a
 * static export builds a display. Each is unknown for the caller to
 * duck-type, since a peer may come from another plugin.
 */
export function viewDisplays(node: IAnyStateTreeNode) {
  const view = containingView(node)
  const tracks =
    view && 'tracks' in view && Array.isArray(view.tracks) ? view.tracks : []
  return tracks.flatMap(displaysOf)
}
