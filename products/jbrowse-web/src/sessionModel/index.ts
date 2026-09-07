import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import {
  BaseWebSessionModel,
  WebSessionManagementMixin,
  finalizeWebSession,
} from '@jbrowse/web-core'

import {
  addPermanentPlugin,
  onPermanentPluginsChanged,
  permanentPluginSafeMode,
  permanentPluginSafeModeSuspects,
  readPermanentPlugins,
  reloadWithPermanentPlugins,
  removePermanentPlugin,
  setPermanentPluginDisabled,
} from '../permanentPlugins.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type {
  SessionWithConfigEditing,
  SessionWithConnectionEditing,
  SessionWithFocusedViewAndDrawerWidgets,
  SessionWithPermanentPlugins,
  SessionWithSessionPlugins,
} from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

// undefined when the permanent plugins loaded normally. The module decides this
// once, when it is first imported, so every session in this load reads the same
// answer — including one created by the plugin-install rebuild.
function safeMode() {
  const reason = permanentPluginSafeMode()
  return reason
    ? { reason, suspects: permanentPluginSafeModeSuspects() }
    : undefined
}

/**
 * #stateModel JBrowseWebSessionModel
 *
 * The full-app web session: the shared web session plus the saved-session
 * database management surface (favorites, recent sessions, activate/delete) and
 * the permanent plugin list.
 */
export default function sessionModelFactory({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return finalizeWebSession(
    pluginManager,
    types
      .compose(
        BaseWebSessionModel({ pluginManager, assemblyConfigSchema }),
        WebSessionManagementMixin(pluginManager),
      )
      .volatile(() => ({
        /**
         * #volatile
         * the plugins installed for this config on this browser, mirrored from
         * localStorage.
         *
         * Volatile rather than a view over storage, because a view is a MobX
         * computed and this one would read no observable: it would compute once
         * inside the plugin store's `observer` and cache the list forever. And
         * volatile rather than a property, because the list belongs to the
         * browser rather than to this session — sharing or exporting a session
         * must not carry it.
         */
        permanentPlugins: readPermanentPlugins(),
        /**
         * #volatile
         * why this load skipped the list, or undefined when it loaded them,
         * decided once at boot
         */
        permanentPluginsSafeMode: safeMode(),
      }))
      .actions(self => ({
        /**
         * #action
         * re-reads the permanent plugin list from the browser, after something
         * outside this session has written it
         */
        syncPermanentPlugins() {
          self.permanentPlugins = readPermanentPlugins()
        },
      }))
      .actions(self => ({
        afterAttach() {
          // every write to the list goes through the module, including the
          // ones that do not go through an action here, so the mirror is
          // refreshed from there rather than at each call site
          addDisposer(
            self,
            onPermanentPluginsChanged(() => {
              self.syncPermanentPlugins()
            }),
          )
        },
        /**
         * #action
         * keeps a plugin for every future visit to this JBrowse, and asks for
         * the whole-app reload every plugin change needs
         */
        addPermanentPlugin(plugin: PluginDefinition) {
          addPermanentPlugin(plugin)
          self.root.setPluginsUpdated()
        },
        /**
         * #action
         */
        removePermanentPlugin(plugin: PluginDefinition) {
          removePermanentPlugin(plugin)
          self.root.setPluginsUpdated()
        },
        /**
         * #action
         * switches a kept plugin off without taking it out of the list, so a
         * user hunting one that crashed the app can keep the innocent ones.
         * No reload is asked for: the entry is one the load already skipped,
         * and rebuilding the app per switch is not what hunting a culprit wants
         */
        setPermanentPluginDisabled(
          plugin: PluginDefinition,
          disabled: boolean,
        ) {
          setPermanentPluginDisabled(plugin, disabled)
        },
        /**
         * #action
         * leaves safe mode: clears the crash marker and reloads the page
         */
        reloadWithPermanentPlugins() {
          reloadWithPermanentPlugins()
        },
      })),
  )
}

export type WebSessionModelType = ReturnType<typeof sessionModelFactory>
export type WebSessionModel = Instance<WebSessionModelType>

// the capability contracts the web app relies on — see AssertSessionModel for
// why each one is asserted separately
export type _AssertSessionModel = AssertSessionModel<WebSessionModel>
export type _AssertFocusedView = AssertExtends<
  WebSessionModel,
  SessionWithFocusedViewAndDrawerWidgets
>
export type _AssertConnectionEditing = AssertExtends<
  WebSessionModel,
  SessionWithConnectionEditing
>
export type _AssertConfigEditing = AssertExtends<
  WebSessionModel,
  SessionWithConfigEditing
>
export type _AssertSessionPlugins = AssertExtends<
  WebSessionModel,
  SessionWithSessionPlugins
>
export type _AssertPermanentPlugins = AssertExtends<
  WebSessionModel,
  SessionWithPermanentPlugins
>
