import {
  localStorageGetItem,
  localStorageSetItem,
  setNumberGrouping,
} from '@jbrowse/core/util'
import { freezeDeep } from '@jbrowse/core/util/freezeDeep'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { BaseSessionModel } from './BaseSession.ts'
import { applyDeveloperMode } from './developerMode.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const PREFS_KEY = 'jbrowsePreferences'

function loadStoredPreferences(): Record<string, unknown> {
  const stored = localStorageGetItem(PREFS_KEY)
  let result: Record<string, unknown> = {}
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored)
      if (typeof parsed === 'object' && parsed !== null) {
        result = parsed as Record<string, unknown>
      }
    } catch {
      // malformed localStorage value; keep empty defaults
    }
  }
  return result
}

/**
 * #stateModel PreferencesSessionMixin
 *
 * loads and persists user-preference overrides (the BaseSession
 * `preferencesOverrides` volatile) to localStorage. Compose into products that
 * let users edit preferences (web, desktop); embedded sessions omit it and
 * resolve preferences from `configuration.preferences` admin defaults only.
 */
export function PreferencesSessionMixin(pluginManager: PluginManager) {
  return types
    .compose(BaseSessionModel(pluginManager), types.model({}))
    .actions(self => ({
      afterAttach() {
        // the restore path bypasses `setPreferenceOverride`, so it freezes here
        // too — a promoted default read back from localStorage is shared by
        // reference exactly like a freshly set one
        self.preferencesOverrides.replace(freezeDeep(loadStoredPreferences()))
        // Applied once, here, rather than reactively: the same setting has to
        // hold in the RPC workers (which format tooltip strings from jexl
        // `mouseover` slots) and they only learn it at boot, so a live
        // main-thread update would leave the app formatted two ways at once.
        // The dialog says a reload is needed; this is where the reload lands.
        setNumberGrouping(self.numberGrouping)
        // and the same second pass for the developer-notice channel, whose
        // admin default BaseSession already read: a user's stored override is
        // only loaded a line above this
        applyDeveloperMode(self)
        addDisposer(
          self,
          autorun(
            function persistPreferences() {
              // observable.map doesn't JSON-serialize to an object on its own;
              // fromEntries also reads every key so the autorun re-persists on
              // any per-key change
              localStorageSetItem(
                PREFS_KEY,
                JSON.stringify(Object.fromEntries(self.preferencesOverrides)),
              )
            },
            { name: 'PreferencesOverrides' },
          ),
        )
      },
    }))
}
