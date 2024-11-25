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
} from 'mobx-state-tree'

import { isBaseSession } from './BaseSession'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { TrackViewModel } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from 'mobx-state-tree'
// locals

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
        walk(getParent(self), node => {
          if (isModelType(getType(node))) {
            const members = getMembers(node)
            Object.entries(members.properties).forEach(([key, value]) => {
              if (isReferenceType(value) && node[key] === object) {
                refs.push({ node, key })
              }
            })
          }
        })
        return refs
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      removeReferring(
        referring: ReferringNode[],
        track: BaseTrackConfig,
        callbacks: ((arg: string) => void)[],
        dereferenceTypeCount: Record<string, number>,
      ) {
        referring.forEach(({ node }) => {
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
            if (!dereferenceTypeCount[type]) {
              dereferenceTypeCount[type] = 0
            }
            dereferenceTypeCount[type] += 1
          } catch (err1) {
            // ignore
          }

          if (isSessionModelWithWidgets(self) && self.widgets.has(node.id)) {
            // If a configuration editor widget has the track config
            // open, close the widget
            const type = 'configuration editor widget(s)'
            if (isSessionModelWithWidgets(self)) {
              callbacks.push(() => {
                self.hideWidget(node)
              })
            }
            dereferenced = true
            if (!dereferenceTypeCount[type]) {
              dereferenceTypeCount[type] = 0
            }
            dereferenceTypeCount[type] += 1
          }
          if (!dereferenced) {
            throw new Error(
              `Error when closing this connection, the following node is still referring to a track configuration: ${JSON.stringify(
                getSnapshot(node),
              )}`,
            )
          }
        })
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
