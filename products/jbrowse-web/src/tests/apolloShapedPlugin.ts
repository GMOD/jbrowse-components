import Plugin from '@jbrowse/core/Plugin'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { InternetAccountType } from '@jbrowse/core/pluggableElementTypes'
import {
  BaseInternetAccountConfig,
  InternetAccount,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

/**
 * A plugin shaped like jbrowse-plugin-apollo, for testing that the host really
 * runs the MST lifecycle hooks a plugin registers.
 *
 * **Why a fixture rather than assertions on our own models.** Every hook in this
 * repo is one we could equally have written as an explicit teardown call, so a
 * test over them can pass for reasons that have nothing to do with the contract.
 * What broke in #5618 broke *only* for code outside the repo: the host stopped
 * destroying a rootModel, every in-repo test stayed green, and
 * jbrowse-plugin-apollo's websockets stopped closing. Catching that class needs
 * something in the suite that behaves like a plugin rather than like us.
 *
 * **What is copied from Apollo, and why each part.** Faithfulness is the whole
 * value — a fixture holding a plain boolean would pass a teardown that a real
 * socket survives:
 *
 * - a **socket on a `.volatile()`**, opened when the model is constructed. MST
 *   teardown never reaches a volatile's contents on its own, so nothing but an
 *   explicit hook closes it (`ApolloInternetAccount/model.ts`, `socket: io(...)`).
 * - a **`window` event listener**, which outlives its model and keeps it
 *   reachable. Apollo registers `beforeunload` and `visibilitychange`.
 * - an **`AbortController`** for in-flight fetches, which Apollo aborts from
 *   both its internet account and its session.
 * - **`beforeDestroy`, not `beforeDetach`.** Apollo's choice, and the one that
 *   made #5618 a bug rather than a preference: the two fire on different events,
 *   so a host that only ever detaches runs neither, nor any `addDisposer`.
 *
 * Both of Apollo's extension points are covered, because they fail
 * independently: an internet account lives on the **rootModel** and a session
 * extension on the **session**. A teardown can reach one and not the other —
 * `setSession` replaces the session without touching the root, and a plugin
 * reload replaces the root wholesale.
 *
 * Lives in jbrowse-web because that is where Apollo runs and where the bug was
 * reported. jbrowse-desktop has the same teardown contract and tests it with a
 * smaller account of its own (`StartScreen/destroyPluginManager.test.ts`) —
 * a cross-product import would be the alternative, and there is no precedent for
 * one here.
 */

/** What a test asserts on: one record per model constructed, in creation order. */
export interface HookRecord {
  socketOpen: boolean
  listenerAttached: boolean
  aborted: boolean
  hookRan: boolean
}

export interface LifecycleProbe {
  internetAccounts: HookRecord[]
  sessions: HookRecord[]
}

/**
 * A module singleton rather than something the test constructs and passes in.
 * The plugin is installed from inside a `jest.mock` factory, which is hoisted
 * above every `const` in the test file — so a probe declared there is in its
 * temporal dead zone at the moment the factory runs. Owning it here sidesteps
 * that, and `jest.requireActual` hands the factory the same module instance the
 * test imports.
 */
export const lifecycleProbe: LifecycleProbe = {
  internetAccounts: [],
  sessions: [],
}

function newRecord(): HookRecord {
  return {
    socketOpen: false,
    listenerAttached: false,
    aborted: false,
    hookRan: false,
  }
}

/**
 * A stand-in for socket.io's client. Only `close` is asserted on, but it keeps a
 * handler map like the real one, so "still open" means here what it means in
 * Apollo: an object with live handlers on it that nothing has released.
 */
function makeSocket(record: HookRecord) {
  const handlers = new Map<string, () => void>()
  record.socketOpen = true
  return {
    on(event: string, cb: () => void) {
      handlers.set(event, cb)
    },
    close() {
      handlers.clear()
      record.socketOpen = false
    },
  }
}

const apolloShapedConfigSchema = ConfigurationSchema(
  'ApolloShapedInternetAccount',
  {},
  { baseConfiguration: BaseInternetAccountConfig, explicitlyTyped: true },
)

/** The config entry that makes a host construct one of these. */
export const APOLLO_SHAPED_ACCOUNT_CONF = {
  type: 'ApolloShapedInternetAccount',
  internetAccountId: 'apolloShaped',
  name: 'Apollo-shaped account',
}

function apolloShapedInternetAccount() {
  const probe = lifecycleProbe
  // the shape every real internet account uses: InternetAccount.named(...).props
  // with a literal `type` and a ConfigurationReference. Composing a plain model
  // over it instead leaves `configuration` a value rather than a reference, and
  // the mixin's autorun then silently constructs nothing.
  return InternetAccount.named('ApolloShapedInternetAccount')
    .props({
      type: types.literal('ApolloShapedInternetAccount'),
      configuration: ConfigurationReference(apolloShapedConfigSchema),
    })
    .volatile(() => {
      const record = newRecord()
      probe.internetAccounts.push(record)
      const onUnload = () => {}
      return { record, socket: makeSocket(record), onUnload }
    })
    .volatile(() => ({ controller: new AbortController() }))
    .actions(self => ({
      afterCreate() {
        globalThis.addEventListener('beforeunload', self.onUnload)
        self.record.listenerAttached = true
        self.socket.on('COMMON', () => {})
      },
      beforeDestroy() {
        globalThis.removeEventListener('beforeunload', self.onUnload)
        self.record.listenerAttached = false
        self.controller.abort()
        self.record.aborted = true
        self.socket.close()
        self.record.hookRan = true
      },
    }))
}

/** Mirrors Apollo's `extendSession`: a controller aborted from `beforeDestroy`. */
function apolloShapedSession(sessionModel: IAnyModelType) {
  const probe = lifecycleProbe
  return sessionModel
    .volatile(() => {
      const record = newRecord()
      probe.sessions.push(record)
      return { apolloShapedRecord: record, controller: new AbortController() }
    })
    .actions(
      (self: {
        apolloShapedRecord: HookRecord
        controller: AbortController
      }) => ({
        beforeDestroy() {
          self.controller.abort()
          self.apolloShapedRecord.aborted = true
          self.apolloShapedRecord.hookRan = true
        },
      }),
    )
}

export function apolloShapedPlugin() {
  return class ApolloShapedPlugin extends Plugin {
    name = 'ApolloShapedPlugin'

    install(pluginManager: PluginManager) {
      pluginManager.addInternetAccountType(
        () =>
          new InternetAccountType({
            name: 'ApolloShapedInternetAccount',
            configSchema: apolloShapedConfigSchema,
            stateModel: apolloShapedInternetAccount(),
          }),
      )
      pluginManager.addToExtensionPoint(
        'Core-extendSession',
        (sessionModel: unknown) =>
          apolloShapedSession(sessionModel as IAnyModelType),
      )
    }
  }
}
