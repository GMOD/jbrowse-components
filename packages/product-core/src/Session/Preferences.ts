import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { BaseSessionModel } from './BaseSession.ts'

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
        self.preferencesOverrides.replace(loadStoredPreferences())
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
