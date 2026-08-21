import {
  applyOrderWithin,
  localStorageGetBoolean,
  localStorageSetBoolean,
  reorderWithin,
} from '@jbrowse/core/util'
import {
  addDisposer,
  applyPatch,
  cast,
  detach,
  getMembers,
  getParent,
  hasParent,
  isReferenceType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { scheduleDetachedDestroy } from '../scheduleDetachedDestroy.ts'
import { BaseSessionModel, isBaseSession } from './BaseSession.ts'
import { DrawerWidgetSessionMixin } from './DrawerWidgets.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import type { ReorderDirection } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

// Whether `node` IS `view` or lives somewhere under it. A view can CONTAIN
// views, so `takeOut` matches widgets to the view leaving by containment rather
// than by `widget.view.id === view.id`. ADR-069 says what that cost.
//
// Deliberately not `findParentThat`, which warns and throws when the walk runs
// out: this asks the question of every reference every widget holds, and most
// of them point somewhere else entirely, so "no" is an ordinary answer here
// rather than a fault.
function isWithin(node: unknown, view: IBaseViewModel) {
  if (!isStateTreeNode(node)) {
    return false
  }
  let cur: IAnyStateTreeNode = node
  while (cur !== view) {
    if (!hasParent(cur)) {
      return false
    }
    cur = getParent(cur)
  }
  return true
}

// Empty every reference `holder` has into `view`, and say whether it had any.
//
// MST invalidates a reference when its TARGET node is detached or destroyed, so
// a widget's reference to the view itself empties on its way out and one
// pointing INSIDE it does not: `openFeatureWidget` stores the clicked feature's
// track, and that node is neither detached nor destroyed — it just leaves the
// session's identifier cache with the view, which makes reading the reference
// THROW where `safeReference` promises undefined. The widget's own autoruns go
// on running whether or not its panel is on screen, so that throw comes out of
// a reaction, uncatchable by the caller.
//
// So do here what `onInvalidated` would have done, while the reference can
// still be read. Only where the type allows undefined — a required reference
// has no empty value to move to, and the widget is hidden either way. ADR-069.
function dropRefsInto(holder: IAnyStateTreeNode, view: IBaseViewModel) {
  let found = false
  for (const [key, prop] of Object.entries(getMembers(holder).properties)) {
    if (isReferenceType(prop) && isWithin(holder[key], view)) {
      found = true
      if (prop.is(undefined)) {
        applyPatch(holder, { op: 'replace', path: `/${key}`, value: undefined })
      }
    }
  }
  return found
}

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
      //
      // **Detached, not removed.** `views.remove` destroys the view and
      // everything under it right here, inside the action, and MobX runs the
      // action's pending reactions at the `endBatch` closing it — so every
      // component still mounted over that view gets a final run against nodes
      // that just died. ADR-069.
      //
      // A view is the worse half of that rule rather than the `setSession`
      // half, because what is mounted over it is a DISPLAY, and a display's
      // reads reach `getContainingView`, which walks parents and THROWS when
      // there is none. So this was not only a noisy console: on
      // `cancer_sv/multihop_split_view` the throw went to an ErrorBoundary with
      // no view left under it and took the page. Detaching leaves the walk
      // something to find.
      const takeOut = (view: IBaseViewModel) => {
        // Membership first, and before anything reads through `view`. A view
        // already out of the session reaches here — `replaceView` documents
        // that case below — and by then it is detached, or destroyed by the
        // task scheduled at the bottom. MST's `detach` throws on a node with no
        // parent, and the widgets holding it were emptied when it left.
        if (!self.views.includes(view)) {
          return
        }
        // The focus is a persisted id, not a reference, so nothing drops it
        // when the view it names goes. Every consumer compares
        // `focusedViewId === view.id`, so a stale one matches nothing — the
        // focus ring vanishes and the drawer stops naming a view, with nothing
        // to say why — and it ships in a saved or shared session. `replaceView`
        // captures `wasFocused` above this and re-points the focus at the
        // replacement afterwards, which is the one case where the focus moves
        // rather than ending.
        if (self.focusedViewId === view.id) {
          self.setFocusedViewId(undefined)
        }
        // Every widget, not the active ones: a widget the user closed keeps
        // its references and its autoruns. One that pointed into the view is
        // now empty, so hide it rather than leave the panel showing what it no
        // longer has.
        for (const [, widget] of self.widgets) {
          if (dropRefsInto(widget, view)) {
            self.hideWidget(widget)
          }
        }
        // MST fires the view's `beforeDetach` here, while it is still attached
        // and the walk to the session still resolves. That matters: anything of
        // a view's that reaches OUTSIDE its own tree has to move to that hook,
        // because after this line the view is a root and `getSession` from a
        // root throws. ADR-069's detach-time disposer, at view scope — the
        // comparative views' `releaseTemporaryAssemblies` is the one case.
        detach(view)
        scheduleDetachedDestroy(view)
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
         * The launchers that build a view of a DIFFERENT type out of one you are
         * already looking at — launch synteny view, read-vs-ref, split view —
         * otherwise append, leaving the source view above the thing it produced
         * and a stack of two views showing the same locus. This is the "replace"
         * half of that offer, and a slot swap rather than remove-then-add so the
         * new view lands where the reader was looking instead of at the bottom of
         * the session.
         *
         * A launcher whose result is the SAME type as its source does not come
         * here and should not: collapse introns offers "Replace current view" by
         * navigating the view it was invoked on, which keeps the view's identity
         * and so lets its snackbar offer an Undo. Swapping in a new node would
         * leave nothing to undo onto.
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
          // before `view.id` is read: that node is detached and, a task later,
          // destroyed — and MST warns on any read through a destroyed one
          const wasFocused = idx !== -1 && self.focusedViewId === view.id
          takeOut(view)
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
          takeOut(view)
        },

        /**
         * #action
         * Take out every view the given session snapshot will not keep, before
         * a whole-tree `applySnapshot` destroys it where it stands.
         *
         * Undo and redo are `applySnapshot` on the session
         * (`core/util/TimeTraveller`, which calls this), and every view carries
         * an `ElementId` — so MST reconciles by identifier and destroys what the
         * target lacks, inside the action, with the components still mounted.
         * Measured on a redo across a closed view, with the restored view
         * repainted first: 4 liveliness reads of its display before this, 0
         * after.
         *
         * A view that is present but has changed `type` is destroyed by that
         * same reconciliation (`areSame` runs the type's `is()` before its id
         * check), so identity here is the pair, not the id.
         *
         * **Views, and deliberately not what is under them.** A track or a
         * display the snapshot drops is still destroyed in place, and that is
         * not this door being worse than the others: `hideTrackGeneric` is a
         * plain `tracks.remove` and measures louder (5 reads to undo's 4).
         * Detaching one would be worse than the destroy it replaced — a
         * detached display is a LIVE root, and `getContainingView` walks
         * parents and throws when the walk finds no view, where a dead node
         * only warns. At or above the view is the only place that walk still
         * lands, which is why ADR-069's rule stops there.
         */
        takeOutViewsMissingFrom(snapshot: unknown) {
          const incoming =
            (
              snapshot as
                | { views?: { id?: string; type?: string }[] }
                | undefined
            )?.views ?? []
          const kept = new Map(incoming.map(v => [v.id, v.type] as const))
          // a copy, because `takeOut` splices the array it is iterating
          for (const view of [...self.views]) {
            if (kept.get(view.id) !== view.type) {
              takeOut(view)
            }
          }
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
