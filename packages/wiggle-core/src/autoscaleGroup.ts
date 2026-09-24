import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
} from '@jbrowse/core/util/mstUtils'
import { hasParent, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/** A display whose value scale can autoscale beside others. */
export interface AutoscaleGroupMember {
  autoscaleGroup: string | undefined
  autoscaleRange: [number, number] | undefined
}

/** A member the score menu can move into or out of a group. */
export interface AutoscalePeer extends AutoscaleGroupMember {
  setAutoscaleGroup: (group?: string) => void
}

function isMember(thing: unknown): thing is AutoscaleGroupMember {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'autoscaleGroup' in thing &&
    'autoscaleRange' in thing
  )
}

function isPeer(thing: unknown): thing is AutoscalePeer {
  return isMember(thing) && 'setAutoscaleGroup' in thing
}

function displaysOf(track: unknown): unknown[] {
  return typeof track === 'object' &&
    track !== null &&
    'displays' in track &&
    Array.isArray(track.displays)
    ? track.displays
    : []
}

function containingView(node: IAnyStateTreeNode): object | undefined {
  if (!isStateTreeNode(node) || !hasParent(node)) {
    return undefined
  }
  try {
    return getContainingView(node)
  } catch {
    return undefined
  }
}

// A display standing outside any view, as a unit test builds one, shares its
// axis with nothing.
function viewDisplays(node: IAnyStateTreeNode) {
  const view = containingView(node)
  const tracks =
    view && 'tracks' in view && Array.isArray(view.tracks) ? view.tracks : []
  return tracks.flatMap(displaysOf)
}

/**
 * Every display in `node`'s view whose value scale names `group`, `node`
 * among them.
 */
export function autoscaleGroupMembers(
  node: IAnyStateTreeNode,
  group: string,
): AutoscaleGroupMember[] {
  return viewDisplays(node).filter(
    (display): display is AutoscaleGroupMember =>
      isMember(display) && display.autoscaleGroup === group,
  )
}

/** The span every defined range covers; undefined where none is. */
export function unionRanges(
  ranges: readonly ([number, number] | undefined)[],
): [number, number] | undefined {
  let union: [number, number] | undefined
  for (const range of ranges) {
    if (range) {
      union = union
        ? [Math.min(union[0], range[0]), Math.max(union[1], range[1])]
        : [range[0], range[1]]
    }
  }
  return union
}

/** The other displays in `node`'s view with a value scale, by track name. */
export function autoscalePeers(node: IAnyStateTreeNode) {
  return viewDisplays(node).flatMap(display => {
    if (!isPeer(display) || display === node) {
      return []
    }
    const track = getContainingTrack(display)
    return [{ display, key: track.id, name: String(getConf(track, 'name')) }]
  })
}

function freeGroupName(taken: ReadonlySet<string | undefined>) {
  let n = 1
  while (taken.has(`group${n}`)) {
    n++
  }
  return `group${n}`
}

/**
 * Put `self` and `chosen` in one group, and take the group off every peer that
 * held it and is not chosen. The group keeps `self`'s name, or a chosen
 * peer's, and is named afresh where neither has one; choosing nobody takes
 * `self` out of its group.
 */
export function autoscaleWith(
  self: AutoscalePeer,
  peers: readonly AutoscalePeer[],
  chosen: ReadonlySet<AutoscalePeer>,
) {
  const previous = self.autoscaleGroup
  const group =
    chosen.size === 0
      ? undefined
      : (previous ??
        [...chosen].find(p => p.autoscaleGroup)?.autoscaleGroup ??
        freeGroupName(new Set(peers.map(p => p.autoscaleGroup))))
  self.setAutoscaleGroup(group)
  for (const peer of peers) {
    if (chosen.has(peer)) {
      peer.setAutoscaleGroup(group)
    } else if (group !== undefined && peer.autoscaleGroup === previous) {
      peer.setAutoscaleGroup(undefined)
    }
  }
}
