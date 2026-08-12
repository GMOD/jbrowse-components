import {
  applyOrderWithin,
  localStorageGetBoolean,
  localStorageSetBoolean,
  reorderWithin,
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
         * enables the tabbed/tiled workspace layout for this session. Undefined
         * means unspecified — read `effectiveUseWorkspaces`.
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
      /**
       * #getter
       * what `effectiveUseWorkspaces` becomes after `resetUseWorkspaces` — the
       * admin default, with both this session's own value and the user's
       * override out of the way. The Preferences reset diff needs this rather
       * than the override map, which can't see a session-scoped value (a spec
       * `layout`, a "move view to a tab") and so reported nothing to reset.
       */
      get defaultUseWorkspaces(): boolean {
        return self.getPreferenceDefault('useWorkspaces') === true
      },
    }))
    .actions(self => {
      // `scopeIds` narrows the move to a subset of the stack: in a tabbed
      // workspace "move this view up" means up past the previous view IN THIS
      // PANEL, and the view that happens to precede it in `self.views` may be
      // in another panel, where moving past it would look like a no-op. Omitted
      // (the classic stack) every view is in scope and this is a plain reorder.
      const move = (
        id: string,
        direction: ReorderDirection,
        scopeIds?: string[],
      ) => {
        const idx = self.views.findIndex(v => v.id === id)
        const scope = scopeIds && new Set(scopeIds)
        self.views = cast(
          reorderWithin(self.views, idx, direction, v =>
            scope ? scope.has(v.id) : true,
          ),
        )
      }
      // The body of removeView, callable from replaceView below — an action
      // can't reach a sibling action through `self` from inside the same
      // .actions() block, since neither is attached yet.
      const detach = (view: IBaseViewModel) => {
        for (const [, widget] of self.activeWidgets) {
          if (widget.view?.id === view.id) {
            self.hideWidget(widget)
          }
        }
        self.views.remove(view)
      }
      return {
        /**
         * #action
         */
        moveViewDown(id: string, scopeIds?: string[]) {
          move(id, 'down', scopeIds)
        },
        /**
         * #action
         */
        moveViewUp(id: string, scopeIds?: string[]) {
          move(id, 'up', scopeIds)
        },
        /**
         * #action
         */
        moveViewToTop(id: string, scopeIds?: string[]) {
          move(id, 'top', scopeIds)
        },

        /**
         * #action
         */
        moveViewToBottom(id: string, scopeIds?: string[]) {
          move(id, 'bottom', scopeIds)
        },

        /**
         * #action
         * Put the named views into the given relative order, leaving views not
         * named in their own slots.
         *
         * `session.views` is the one ordering, so this is how a channel that
         * states an order in some other vocabulary gets it applied: a session
         * spec's `layout` names views per panel, top to bottom, and that used to
         * be honoured by the panel assignment array's order. Now the assignment
         * carries membership only, so the layout says it here instead, once.
         */
        orderViews(ids: string[]) {
          self.views = cast(applyOrderWithin(self.views, ids, v => v.id))
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
         * swap `view` for a new view of `typeName`, in the slot it occupied.
         *
         * The launchers that build a view out of one you are already looking at
         * — collapse introns, launch synteny view — otherwise append, leaving
         * the source view above the thing it produced and a stack of two views
         * showing the same locus. This is the "replace" half of that offer, and
         * a slot swap rather than remove-then-add so the new view lands where
         * the reader was looking instead of at the bottom of the session.
         *
         * The slot is `session.views`, which is the order views render in under
         * both layout modes (a tab's `viewIds` says which tab a view is in, not
         * where in it), so the swap lands in place either way.
         *
         * WHICH panel is a separate question and this does not answer it: the
         * new view arrives in no tab, and `homeUnassignedViews` puts it in the
         * active panel — the same panel only when the replaced view was in the
         * active one. In practice it is, since clicking into a view activates
         * its panel, and the launch that offers a replace is a click on that
         * view's own menu.
         */
        replaceView(view: IBaseViewModel, typeName: string, initialState = {}) {
          // read before the removal, which is what makes both stale
          const idx = self.views.indexOf(view)
          // `idx` first, so a view already gone from the session short-circuits
          // before `view.id` is read: that node is destroyed, and MST warns on
          // any read through it
          const wasFocused = idx !== -1 && self.focusedViewId === view.id
          detach(view)
          // a view already gone from the session appends, rather than throwing
          // or silently dropping the launch
          const at = idx === -1 ? self.views.length : idx
          self.views.splice(at, 0, { ...initialState, type: typeName })
          const created = self.views[at]!
          // The replacement takes the slot, so it takes the focus with it.
          // Every consumer compares `focusedViewId === view.id`, so a
          // replacement that left the old id in place would simply match
          // nothing: the focus ring would vanish and the drawer would stop
          // naming a view, with nothing to say why.
          if (wasFocused) {
            self.setFocusedViewId(created.id)
          }
          return created
        },

        /**
         * #action
         */
        removeView(view: IBaseViewModel) {
          detach(view)
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
      // `layout` tree the snapshot carries), which is meaningful to share.
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
