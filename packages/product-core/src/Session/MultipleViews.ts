import {
  localStorageGetBoolean,
  localStorageSetBoolean,
  reorder,
} from '@jbrowse/core/util'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { BaseSessionModel, isBaseSession } from './BaseSession.ts'
import { DrawerWidgetSessionMixin } from './DrawerWidgets.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import type { ReorderDirection } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel MultipleViewsSessionMixin
 */
export function MultipleViewsSessionMixin(pluginManager: PluginManager) {
  return types
    .compose(
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      types.model({
        /**
         * #property
         */
        views: types.array(
          pluginManager.pluggableMstType('view', 'stateModel'),
        ),
        /**
         * #property
         */
        stickyViewHeaders: types.optional(types.boolean, () =>
          localStorageGetBoolean('stickyViewHeaders', true),
        ),
        /**
         * #property
         * enables the dockview-based tabbed/tiled workspace layout for this
         * session. Undefined means unspecified — read `effectiveUseWorkspaces`.
         */
        useWorkspaces: types.stripDefault(
          types.maybe(types.boolean),
          undefined,
        ),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * resolved workspaces flag (never undefined): this session's value, else
       * the user preference over the `configuration.preferences.useWorkspaces`
       * admin default. Every consumer reads this, not the raw property — only
       * sessions built from a snapshot or a spec `layout` set that, so the
       * admin default is what reaches the arrivals that bypass defaultSession.
       */
      get effectiveUseWorkspaces(): boolean {
        return (
          self.useWorkspaces ?? self.getPreference('useWorkspaces') === true
        )
      },
    }))
    .actions(self => {
      const move = (id: string, direction: ReorderDirection) => {
        const idx = self.views.findIndex(v => v.id === id)
        self.views = cast(reorder(self.views, idx, direction))
      }
      return {
        /**
         * #action
         */
        moveViewDown(id: string) {
          move(id, 'down')
        },
        /**
         * #action
         */
        moveViewUp(id: string) {
          move(id, 'up')
        },
        /**
         * #action
         */
        moveViewToTop(id: string) {
          move(id, 'top')
        },

        /**
         * #action
         */
        moveViewToBottom(id: string) {
          move(id, 'bottom')
        },

        /**
         * #action
         */
        addView(typeName: string, initialState = {}) {
          const length = self.views.push({
            ...initialState,
            type: typeName,
          })
          return self.views[length - 1]
        },

        /**
         * #action
         */
        removeView(view: IBaseViewModel) {
          for (const [, widget] of self.activeWidgets) {
            if (widget.view?.id === view.id) {
              self.hideWidget(widget)
            }
          }
          self.views.remove(view)
        },

        /**
         * #action
         */
        setStickyViewHeaders(sticky: boolean) {
          self.stickyViewHeaders = sticky
        },

        /**
         * #action
         * set the workspaces layout for this session only, leaving the user's
         * personal default untouched. For session-scoped intent — a spec
         * carrying a `layout`, or an ad-hoc "move view to a tab/split" — where
         * rewriting the visitor's global preference would be a surprise. The
         * user-facing default toggle is `setUseWorkspacesPreference`.
         */
        setUseWorkspaces(useWorkspaces: boolean) {
          self.useWorkspaces = useWorkspaces
        },

        /**
         * #action
         * the user-facing workspaces toggle: applies to this session and
         * becomes their default for sessions that don't specify one. Persisted
         * only here, on an explicit toggle — an autorun mirroring the resolved
         * value would bake the admin default into every visitor's localStorage
         * on first load, so a later admin change could never reach them.
         */
        setUseWorkspacesPreference(useWorkspaces: boolean) {
          self.useWorkspaces = useWorkspaces
          self.setPreferenceOverride('useWorkspaces', useWorkspaces)
        },

        /**
         * #action
         * drop both this session's explicit value and the user's override so
         * workspaces falls back to the admin default
         */
        resetUseWorkspaces() {
          self.useWorkspaces = undefined
          self.clearPreferenceOverride('useWorkspaces')
        },

        afterAttach() {
          addDisposer(
            self,
            autorun(
              function stickyViewHeadersAutorun() {
                localStorageSetBoolean(
                  'stickyViewHeaders',
                  self.stickyViewHeaders,
                )
              },
              { name: 'StickyViewHeaders' },
            ),
          )
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // stickyViewHeaders is a personal per-browser UI preference, not shared
      // view state: destructure it out so it never lands in the snapshot. It
      // stays localStorage-backed, so each browser keeps its own value.
      // useWorkspaces stays: it changes layout intent (and pairs with the
      // dockviewLayout the snapshot carries), which is meaningful to share.
      const { stickyViewHeaders, ...rest } = snap
      return rest as typeof snap
    })
}

/** Session mixin MST type for a session that manages multiple views */
export type SessionWithMultipleViewsType = ReturnType<
  typeof MultipleViewsSessionMixin
>

/** Instance of a session with multiple views */
export type SessionWithMultipleViews = Instance<SessionWithMultipleViewsType>

/** Type guard for SessionWithMultipleViews */
export function isSessionWithMultipleViews(
  session: IAnyStateTreeNode,
): session is SessionWithMultipleViews {
  return isBaseSession(session) && 'views' in session
}
