import { resolvePalette } from '@jbrowse/core/ui/palette'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnimationMode, SnackAction } from '@jbrowse/core/util'
import type { IAnyModelType, Instance } from '@jbrowse/mobx-state-tree'

/** What a queued dialog was called with, resolved to `[Component, props]`. */
export type QueuedDialog = [unknown, Record<string, unknown>]

/**
 * The stub session a display harness mounts its view inside.
 *
 * **One model with every member any display reaches for**, rather than ten
 * hand-written subsets. The subsets were the bug: `palette` — what every
 * model-side color getter reads through `getSession(self).palette` — was stubbed
 * by two harnesses of ten, each surfacing only as a runtime `TypeError` inside
 * a MobX reaction in whichever suite happened to reach it. Nothing here is
 * expensive, so a harness that never touches a member pays for it in nothing
 * but its presence.
 *
 * A harness needing an extra prop composes rather than forking:
 * `types.compose('X', displayTestSessionModel({…}), types.model({ stack }))`.
 */
export function displayTestSessionModel<VIEW extends IAnyModelType>({
  viewModel,
  rpcManager = {},
  assemblyManager,
  getTrackById,
}: {
  viewModel: VIEW
  rpcManager?: unknown
  assemblyManager: unknown
  /** the harness's own track-config lookup, closed over its `trackConfig` */
  getTrackById: (id: string) => unknown
}) {
  return types
    .model('DisplayTestSession', {
      name: 'testSession',
      view: types.maybe(viewModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager,
      assemblyManager,
      theme: createJBrowseTheme(),
      palette: resolvePalette(),
      // `animationAllowed(getSession(self).animationMode)` gates canvas's Y
      // morph, and absent this it read `undefined` — so every display suite ran
      // with the morph off and `installYMorphAutorun` only ever took its
      // `endYMorph` branch. The same silent shape as the `palette` gap above,
      // minus the `TypeError` that made that one findable: a missing gate input
      // reads as a refusal, and a refusal is what a green suite looks like.
      //
      // Nothing pumps `requestAnimationFrame` under jsdom, so a morph a test
      // starts stays at progress 0 and `renderDataMap` keeps answering the OLD
      // rows for the rest of that test. Read `laidOutDataMap` for the settled
      // layout, or drive `setMorphProgress` by hand.
      animationMode: 'enabled' as AnimationMode,
      queuedDialogs: [] as QueuedDialog[],
      // what `getSession(self).selection` answers — the globally-selected
      // feature a display highlights against
      selection: undefined as unknown,
      // What the session was asked to tell the user, in order. Recorded rather
      // than dropped because "the user was told nothing" is a real assertion —
      // a click whose lookup comes back empty and says nothing is the failure
      // `notifyFeatureDetailsMiss` exists for, and a no-op `notify` cannot tell
      // that apart from a working one. The `actions` are recorded too, so a
      // snackbar's offer stays reachable from a test.
      notifications: [] as {
        message: string
        level?: string
        actions: SnackAction[]
      }[],
      // Present so `isSessionModelWithWidgets` holds -- a display whose click
      // opens the feature-details widget takes the no-widgets branch otherwise,
      // and the hand-off below is never made at all.
      widgets: new Map<string, unknown>(),
      // What a display asked the drawer to open, in order: each widget's whole
      // initial state, verbatim. The click's hand-off is the assertable part --
      // which feature it opened on, and which containing feature it says that
      // one was reached through -- and it is a plain record here for the same
      // reason `notifications` is: a real widget tree would answer these
      // questions through a second model's rendering.
      openedWidgets: [] as Record<string, unknown>[],
    }))
    .views(() => ({
      getTrackById,
    }))
    .actions(self => ({
      setView(view: Instance<VIEW>) {
        self.view = view
        return view
      },
      notify(
        message: string,
        level?: string,
        action?: SnackAction | SnackAction[],
      ) {
        self.notifications.push({
          message,
          level,
          actions: action ? (Array.isArray(action) ? action : [action]) : [],
        })
      },
      notifyError(message: string) {
        self.notifications.push({ message, level: 'error', actions: [] })
      },
      queueDialog(cb: (handleClose: () => void) => QueuedDialog) {
        self.queuedDialogs.push(cb(() => {}))
      },
      setSelection(thing: unknown) {
        self.selection = thing
      },
      addWidget(
        type: string,
        id: string,
        initialState?: Record<string, unknown>,
      ) {
        const widget = { ...initialState, type, id }
        self.openedWidgets.push(widget)
        return widget
      },
      showWidget(_widget: unknown) {},
    }))
}

/**
 * Run an action the last snackbar offered.
 */
export function takeSnackbarAction(
  session: {
    notifications: { message: string; actions: SnackAction[] }[]
  },
  name = 'Set as the default',
) {
  const last = session.notifications.at(-1)
  const found = last?.actions.find(action => action.name === name)
  if (!found) {
    throw new Error(
      `no snackbar action "${name}"; last toast was ${JSON.stringify(last?.message)} offering ${JSON.stringify(last?.actions.map(a => a.name) ?? [])}`,
    )
  }
  found.onClick()
}
