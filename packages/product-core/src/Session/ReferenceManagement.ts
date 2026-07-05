/** MST props, views, actions, etc related to managing connections */

import {
  getContainingView,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  getMembers,
  getParent,
  getSnapshot,
  getType,
  isModelType,
  isReferenceType,
  types,
  walk,
} from '@jbrowse/mobx-state-tree'

import { isBaseSession } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { TrackViewModel } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

/**
 * #stateModel ReferenceManagementSessionMixin
 */
export function ReferenceManagementSessionMixin(_pluginManager: PluginManager) {
  return types
    .model('ReferenceManagementSessionMixin', {})
    .views(self => ({
      /**
       * #method
       * Walk the tree once and map each requested trackId to the nodes holding a
       * `types.reference` that resolves to it (a view's track entry, a config
       * editor widget). Track configs are matched by trackId, not identity, so a
       * frozen base and its hydrated MST node compare equal.
       */
      getReferringMultiple(trackIds: string[]): Map<string, ReferringNode[]> {
        const ids = new Set(trackIds)
        const result = new Map<string, ReferringNode[]>()
        if (ids.size === 0) {
          return result
        }
        walk(getParent(self), node => {
          if (isModelType(getType(node))) {
            for (const [key, value] of Object.entries(
              getMembers(node).properties,
            )) {
              if (isReferenceType(value)) {
                const id = node[key]?.trackId
                if (id !== undefined && ids.has(id)) {
                  const existing = result.get(id) ?? []
                  existing.push({ node, key })
                  result.set(id, existing)
                }
              }
            }
          }
        })
        return result
      },
    }))
    .views(self => ({
      /**
       * #method
       * The nodes currently referring to `trackId` (see getReferringMultiple).
       */
      getReferring(trackId: string): ReferringNode[] {
        return self.getReferringMultiple([trackId]).get(trackId) ?? []
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Remove `trackId` from every view referring to it and close any config
       * editor widget open on it. Runs immediately: the walk that produced
       * `referring` has finished, so mutating those views here is safe.
       */
      dereferenceTrack(trackId: string, referring: ReferringNode[]) {
        for (const { node } of referring) {
          let view: TrackViewModel | undefined
          try {
            view = getContainingView(node) as TrackViewModel
          } catch {
            // node isn't contained in a view (e.g. it's a widget)
          }
          const widget =
            isSessionModelWithWidgets(self) && self.widgets.has(node.id)
          if (view) {
            view.hideTrack(trackId)
          } else if (widget) {
            self.hideWidget(node)
          } else {
            throw new Error(
              `node still refers to track ${trackId}: ${JSON.stringify(
                getSnapshot(node),
              )}`,
            )
          }
        }
      },
    }))
}

/** Session mixin MST type for a session that manages multiple views */
export type SessionWithReferenceManagementType = ReturnType<
  typeof ReferenceManagementSessionMixin
>

/** Instance of a session with MST reference management (`getReferring()`, `dereferenceTrack()`)  */
export type SessionWithReferenceManagement =
  Instance<SessionWithReferenceManagementType>

/** Type guard for SessionWithReferenceManagement */
export function isSessionWithReferenceManagement(
  thing: IAnyStateTreeNode,
): thing is SessionWithReferenceManagement {
  return (
    isBaseSession(thing) &&
    'getReferring' in thing &&
    typeof thing.getReferring === 'function' &&
    'dereferenceTrack' in thing &&
    typeof thing.dereferenceTrack === 'function'
  )
}
