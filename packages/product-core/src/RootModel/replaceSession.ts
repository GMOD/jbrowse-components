import { scheduleDetachedDestroy } from '@jbrowse/core/util'
import { detach } from '@jbrowse/mobx-state-tree'

import {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from '../pruneUnbuildableNodes.ts'
import { migrateSessionSnapshot } from '../sessionMigrations/index.ts'
import { dropUnloadableTracks } from '../sessionUtils.ts'

import type { UnbuildableNode } from '../pruneUnbuildableNodes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * A session snapshot made loadable by this build: retired display types
 * remapped, and nodes whose pluggable type no plugin registers dropped. The
 * drop has to happen before the assignment, because such a type is a union
 * failure that fails the whole session.
 */
export function prepareSessionSnapshot(
  snapshot: Record<string, unknown>,
  pluginManager: PluginManager,
  sessionModelType: IAnyType,
) {
  pluginManager.assertSessionTypesLoaded(snapshot)
  return pruneUnbuildableNodes(
    migrateSessionSnapshot(snapshot, pluginManager),
    pluginManager,
    sessionModelType,
  )
}

/**
 * Tells the user what `prepareSessionSnapshot` dropped, then drops the open
 * tracks whose config can't hydrate, which only the built tree can show.
 */
export function reportDroppedNodes(
  session: Parameters<typeof dropUnloadableTracks>[0],
  dropped: UnbuildableNode[],
) {
  const message = describeUnbuildableNodes(dropped)
  if (message) {
    session.notify?.(message, 'warning')
  }
  dropUnloadableTracks(session)
}

/**
 * Swaps a root's optional `session` slot for a snapshot. `assign` writes the
 * slot and returns what is now in it; it is called again with the old session
 * if the new one throws.
 */
export function replaceSession({
  pluginManager,
  sessionModelType,
  oldSession,
  snapshot,
  assign,
}: {
  pluginManager: PluginManager
  sessionModelType: IAnyType
  oldSession: IAnyStateTreeNode | undefined
  snapshot: Record<string, unknown> | undefined
  assign: (value: unknown) => AbstractSessionModel | undefined
}) {
  const prepared = snapshot
    ? prepareSessionSnapshot(snapshot, pluginManager, sessionModelType)
    : { snapshot, dropped: [] }
  // Detach first: assigning over it would destroy it inside this action, and
  // MobX runs the action's pending reactions afterwards, against the nodes it
  // just killed. ADR-069.
  if (oldSession) {
    detach(oldSession)
  }
  // The assignment is inside the try because it typechecks: a registered type
  // carrying a malformed prop is a throw the prune does not and cannot
  // pre-empt, and the detach above has already emptied the slot. MST does not
  // roll an action back, so without this the root would be left with no
  // session at all and the old tree detached-and-alive forever.
  try {
    const session = assign(prepared.snapshot)
    if (session) {
      reportDroppedNodes(session, prepared.dropped)
    }
  } catch (error) {
    // the one path where the old session goes on being the live one, so no
    // destroy is scheduled for it
    assign(oldSession)
    throw error
  }
  // `beforeDestroy` is a plugin-facing contract, and a detached session left
  // alive forever would skip it, so it is destroyed once React lets go. ADR-069
  if (oldSession) {
    scheduleDetachedDestroy(oldSession)
  }
}
