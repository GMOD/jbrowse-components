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
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
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
       * See if any MST nodes currently have a types.reference to this object.
       *
       * @param object - object
       * @returns An array where the first element is the node referring
       * to the object and the second element is they property name the node is
       * using to refer to the object
       */
      getReferring(object: IAnyStateTreeNode) {
        const refs: ReferringNode[] = []
        // For frozen tracks, compare by trackId instead of object identity
        const targetTrackId = (object as { trackId?: string }).trackId
        walk(getParent(self), node => {
          if (isModelType(getType(node))) {
            const members = getMembers(node)
            for (const [key, value] of Object.entries(members.properties)) {
              if (isReferenceType(value)) {
                const ref = node[key]
                // Compare by trackId for track configurations, fall back to identity
                const refTrackId = ref?.trackId
                if (
                  ref === object ||
                  (targetTrackId && refTrackId && refTrackId === targetTrackId)
                ) {
                  refs.push({ node, key })
                }
              }
            }
          }
        })
        return refs
      },

      /**
       * Batch version of getReferring: walks the tree once and returns a map
       * from trackId to referring nodes. Use this instead of calling
       * getReferring() in a loop to avoid O(n × treeSize) traversals.
       */
      getReferringMultiple(tracks: IAnyStateTreeNode[]) {
        const byTrackId = new Map<string, IAnyStateTreeNode>()
        const byIdentity = new Map<IAnyStateTreeNode, string>()
        for (const t of tracks) {
          const id = (t as { trackId?: string }).trackId
          if (id) {
            byTrackId.set(id, t)
            byIdentity.set(t, id)
          }
        }
        const result = new Map<string, ReferringNode[]>()
        if (byTrackId.size === 0) {
          return result
        }
        walk(getParent(self), node => {
          if (isModelType(getType(node))) {
            const members = getMembers(node)
            for (const [key, value] of Object.entries(members.properties)) {
              if (isReferenceType(value)) {
                const ref = node[key]
                const trackId =
                  (ref?.trackId !== undefined && byTrackId.has(ref.trackId)
                    ? ref.trackId
                    : undefined) ?? byIdentity.get(ref)
                if (trackId !== undefined) {
                  const existing = result.get(trackId) ?? []
                  existing.push({ node, key })
                  result.set(trackId, existing)
                }
              }
            }
          }
        })
        return result
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      removeReferring(
        referring: ReferringNode[],
        track: BaseTrackConfig,
        callbacks: (() => void)[],
        dereferenceTypeCount: Record<string, number>,
      ) {
        for (const { node } of referring) {
          let dereferenced = false
          try {
            // If a view is referring to the track config, remove the track
            // from the view
            const type = 'open track(s)'
            const view = getContainingView(node) as TrackViewModel
            callbacks.push(() => {
              view.hideTrack(track.trackId)
            })
            dereferenced = true
            dereferenceTypeCount[type] ??= 0
            dereferenceTypeCount[type] += 1
          } catch {
            // ignore
          }

          if (isSessionModelWithWidgets(self) && self.widgets.has(node.id)) {
            // If a configuration editor widget has the track config
            // open, close the widget
            const type = 'configuration editor widget(s)'
            callbacks.push(() => {
              self.hideWidget(node)
            })
            dereferenced = true
            dereferenceTypeCount[type] ??= 0
            dereferenceTypeCount[type] += 1
          }
          if (!dereferenced) {
            throw new Error(
              `Error when closing this connection, the following node is still referring to a track configuration: ${JSON.stringify(
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

/** Instance of a session with MST reference management (`getReferring()`, `removeReferring()`)  */
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
    'removeReferring' in thing &&
    typeof thing.removeReferring === 'function'
  )
}
