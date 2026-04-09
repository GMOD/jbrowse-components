import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * Mixin that provides a single `configOverrides` map for runtime display
 * config overrides. Replaces the pattern of individual `types.maybe()`
 * properties (e.g. `trackShowLabels`, `colorSetting`) with one frozen map.
 *
 * Usage in a display model:
 *
 *   .compose(ConfigOverrideMixin(), ...)
 *   .views(self => ({
 *     get displayMode() {
 *       return self.getConfWithOverride('displayMode')
 *     },
 *   }))
 *   .actions(self => ({
 *     setDisplayMode(value: string) {
 *       self.setOverride('displayMode', value)
 *     },
 *   }))
 */
/**
 * Migrate old `*Setting` snapshot properties into `configOverrides`.
 * Automatically strips the `Setting` suffix to derive the config key.
 * Use in preProcessSnapshot to handle backward compat with old snapshots.
 */
export function migrateOldSettingSnapshots(
  snap: Record<string, unknown>,
  extraMappings?: Record<string, string>,
) {
  const overrides: Record<string, unknown> = {}
  const rest = { ...snap }

  for (const key of Object.keys(rest)) {
    if (key.endsWith('Setting')) {
      const configKey = key.slice(0, -7) // strip 'Setting'
      overrides[configKey] = rest[key]
      delete rest[key]
    }
  }

  if (extraMappings) {
    for (const [oldKey, newKey] of Object.entries(extraMappings)) {
      if (rest[oldKey] !== undefined) {
        overrides[newKey] = rest[oldKey]
        delete rest[oldKey]
      }
    }
  }

  if (Object.keys(overrides).length === 0) {
    return rest
  }
  return {
    ...rest,
    configOverrides: {
      ...(rest.configOverrides as Record<string, unknown> | undefined),
      ...overrides,
    },
  }
}

export default function ConfigOverrideMixin() {
  return types
    .model({
      configOverrides: types.optional(
        types.frozen<Record<string, unknown>>(),
        {},
      ),
    })
    .views(self => ({
      getOverride<T>(key: string) {
        const val = self.configOverrides[key]
        return val as T | undefined
      },
      getConfWithOverride<T>(key: string) {
        const val = self.configOverrides[key]
        if (val !== undefined) {
          return val as T
        }
        return getConf(self as Parameters<typeof getConf>[0], key) as T
      },
    }))
    .actions(self => ({
      setOverride(key: string, value: unknown) {
        self.configOverrides = { ...self.configOverrides, [key]: value }
      },
      clearOverride(key: string) {
        const { [key]: _, ...rest } = self.configOverrides
        self.configOverrides = rest
      },
    }))
    .postProcessSnapshot(snap => {
      const { configOverrides, ...rest } = snap as Omit<typeof snap, symbol>
      if (Object.keys(configOverrides).length === 0) {
        return rest as typeof snap
      }
      return snap
    })
}
