import { types } from '@jbrowse/mobx-state-tree'

/**
 * Migrate old `*Setting` snapshot properties to flat config override keys.
 * Automatically strips the `Setting` suffix to derive the config key.
 * Use in preProcessSnapshot to handle backward compat with old snapshots.
 */
export function migrateOldSettingSnapshots(
  snap: Record<string, unknown>,
  extraMappings?: Record<string, string>,
) {
  const migrated: Record<string, unknown> = {}
  const rest = { ...snap }

  for (const key of Object.keys(rest)) {
    if (key.endsWith('Setting')) {
      const configKey = key.slice(0, -7) // strip 'Setting'
      migrated[configKey] = rest[key]
      delete rest[key]
    }
  }

  if (extraMappings) {
    for (const [oldKey, newKey] of Object.entries(extraMappings)) {
      if (rest[oldKey] !== undefined) {
        migrated[newKey] = rest[oldKey]
        delete rest[oldKey]
      }
    }
  }

  return { ...rest, ...migrated }
}

/**
 * #stateModel ConfigOverrideMixin
 * #category display
 *
 * Provides a runtime override map for display config slots. Pass the list of
 * config slot names that can be overridden; these are serialized flat on the
 * session snapshot (not nested under a sub-key) for readability.
 *
 * Read with `getConfWithOverride` (override wins, else config slot value) or
 * `getOverride` (override only). Write with `setOverride`/`clearOverride`.
 */
export default function ConfigOverrideMixin(
  configKeys: readonly string[] = [],
) {
  return types
    .model({
      // Internal override map. Not serialized directly — postProcessSnapshot
      // spreads it flat onto the snapshot; preProcessSnapshot collects it back.
      configOverrides: types.optional(
        types.frozen<Record<string, unknown>>(),
        {},
      ),
    })
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const s = snap as Record<string, unknown>
      // Collect declared flat config keys into the internal override map.
      // Any `configOverrides` sub-key already in the snapshot (e.g. from an
      // older saved session) is left in `rest` for MST to hydrate directly.
      const fromFlat: Record<string, unknown> = {}
      const rest: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(s)) {
        if (configKeys.includes(k)) {
          fromFlat[k] = v
        } else {
          rest[k] = v
        }
      }
      if (Object.keys(fromFlat).length === 0) {
        return rest
      }
      return { ...rest, configOverrides: fromFlat }
    })
    .views(self => ({
      /**
       * #method
       * the override value for a key, or undefined if not overridden
       */
      getOverride<T>(key: string) {
        const val = self.configOverrides[key]
        return val as T | undefined
      },
      /**
       * #method
       * the override value if set, otherwise the resolved config slot value
       */
      getConfWithOverride<T>(key: string) {
        const val = self.configOverrides[key]
        if (val !== undefined) {
          return val as T
        }
        // ConfigOverrideMixin is always composed with models that provide
        // 'configuration'. Access it via plain-object cast to avoid propagating
        // MST internal symbol types ($stateTreeNodeType) into declaration files.
        const conf = (
          self as unknown as { configuration: Record<string, unknown> }
        ).configuration
        const slot = conf[key]
        if (
          slot !== null &&
          slot !== undefined &&
          typeof (slot as { getValue?: unknown }).getValue === 'function'
        ) {
          return (slot as { getValue: () => T }).getValue()
        }
        return slot as T
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setOverride(key: string, value: unknown) {
        self.configOverrides = { ...self.configOverrides, [key]: value }
      },
      /**
       * #action
       */
      clearOverride(key: string) {
        const { [key]: _, ...rest } = self.configOverrides
        self.configOverrides = rest
      },
    }))
    .postProcessSnapshot(snap => {
      const { configOverrides, ...rest } = snap
      if (Object.keys(configOverrides).length === 0) {
        return rest as typeof snap
      }
      // Spread overrides flat onto the snapshot for readability.
      return { ...rest, ...configOverrides } as typeof snap
    })
}
