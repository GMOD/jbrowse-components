import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { BaseSessionModel, displayTypeDefaultKey } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const PREFS_KEY = 'jbrowsePreferences'

// The old nested-object storage key promoted defaults used before they were
// flattened. Only referenced by the one-time migration below. Distinct in
// meaning from BaseSession's `DTD_PATH_HEAD` (a UI routing tag that happens to
// share this string) — don't merge the two.
const LEGACY_DTD_STORE_KEY = 'displayTypeDefaults'

// One-time upgrade of a localStorage blob written before promoted defaults were
// flattened: expand a legacy nested `displayTypeDefaults` object into flat
// per-(type, slot) keys (see BaseSession `displayTypeDefaultKey`) and drop the
// nested key. A flat key already present (newer format) wins.
function migrateLegacyDisplayTypeDefaults(overrides: {
  get: (k: string) => unknown
  set: (k: string, v: unknown) => void
  delete: (k: string) => void
}) {
  const legacy = overrides.get(LEGACY_DTD_STORE_KEY)
  if (typeof legacy === 'object' && legacy !== null) {
    for (const [displayType, slots] of Object.entries(legacy)) {
      if (typeof slots === 'object' && slots !== null) {
        for (const [slot, value] of Object.entries(slots)) {
          const key = displayTypeDefaultKey(displayType, slot)
          if (overrides.get(key) === undefined) {
            overrides.set(key, value)
          }
        }
      }
    }
    overrides.delete(LEGACY_DTD_STORE_KEY)
  }
}

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
        migrateLegacyDisplayTypeDefaults(self.preferencesOverrides)
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
