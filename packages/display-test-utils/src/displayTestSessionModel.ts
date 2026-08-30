import { resolvePalette } from '@jbrowse/core/ui/palette'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'

import type { SnackAction } from '@jbrowse/core/util'
import type { IAnyModelType, Instance } from '@jbrowse/mobx-state-tree'

/** What a queued dialog was called with, resolved to `[Component, props]`. */
export type QueuedDialog = [unknown, Record<string, unknown>]

/**
 * The stub session a display harness mounts its view inside.
 *
 * **One model with every member any display reaches for**, rather than ten
 * hand-written subsets. The subsets were the bug: `palette` — what every
 * model-side color getter reads through `getSession(self).palette` — was stubbed
 * by two harnesses of ten, and `getDisplayTypeDefault` was missing from
 * twenty-one of twenty-eight session fakes in the repo, each surfacing only as a
 * runtime `TypeError` inside a MobX reaction in whichever suite happened to
 * reach it. Nothing here is expensive, so a harness that never touches a member
 * pays for it in nothing but its presence.
 *
 * `displayTypeDefaults` is the promotable cascade's middle tier, in the same
 * `displayType -> slot -> value` shape `BaseSession` stores flat. Reassigned
 * wholesale on write so the display's `resolveConf` getters track it reactively.
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
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
    })
    .volatile(() => ({
      rpcManager,
      assemblyManager,
      theme: createJBrowseTheme(),
      palette: resolvePalette(),
      queuedDialogs: [] as QueuedDialog[],
      // what `getSession(self).selection` answers — the globally-selected
      // feature a display highlights against
      selection: undefined as unknown,
      // What the session was asked to tell the user, in order. Recorded rather
      // than dropped because "the user was told nothing" is a real assertion —
      // a click whose lookup comes back empty and says nothing is the failure
      // `notifyFeatureDetailsMiss` exists for, and a no-op `notify` cannot tell
      // that apart from a working one. The `actions` are recorded too: a
      // promotable pin's click applies its value and offers the display-type
      // default as a snackbar action, so dropping them left the promotion
      // unreachable from a test.
      notifications: [] as {
        message: string
        level?: string
        actions: SnackAction[]
      }[],
    }))
    .views(self => ({
      getTrackById,
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
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
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
      },
    }))
}

/**
 * Run an action the last snackbar offered. A promotable pin's click applies its
 * value to the open tracks and offers the display-type default as the toast's
 * one action, so a test asserting on `getDisplayTypeDefault` has to take this
 * second step — the click alone deliberately promotes nothing.
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
