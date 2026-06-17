import { isCallbackValue, readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from '@jbrowse/core/configuration'

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
/**
 * `CONF` — the display's config model type; narrows `getConfWithOverride` key
 * args to valid slot names when a concrete type is passed.
 *
 * `EXTRA` — additional keys that are stored flat in the snapshot but are NOT
 * config slots (no fallback to a config value). Use these for pure runtime
 * state that persists via the snapshot mechanism. They are accepted by
 * `getOverride`/`setOverride`/`clearOverride` but NOT by `getConfWithOverride`
 * (which requires a config-slot fallback).
 */
export default function ConfigOverrideMixin<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
  EXTRA extends string = never,
>(
  configKeys: readonly (
    | ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>
    | EXTRA
  )[] = [],
) {
  type SlotName = ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>
  type AnyKey = SlotName | EXTRA
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
      // Strip any stale `configOverrides` sub-key (not a supported input
      // format), then collect declared flat config keys into the internal map.
      const { configOverrides: _, ...s } = snap as Record<string, unknown>
      const fromFlat: Record<string, unknown> = {}
      const rest: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(s)) {
        if ((configKeys as readonly string[]).includes(k)) {
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
      getOverride<T>(key: AnyKey) {
        const val = self.configOverrides[key]
        return val as T | undefined
      },
      /**
       * #method
       * the override value if set, otherwise the resolved config slot value.
       * Return type is derived from the schema slot (scalar slots are typed
       * precisely; object/array/frozen slots degrade to `any`), mirroring the
       * adapter `getConf`.
       */
      getConfWithOverride<SLOT extends SlotName = SlotName>(
        key: SLOT,
      ): ConfigurationSlotValue<ConfigurationSchemaForModel<CONF>, SLOT> {
        const val = self.configOverrides[key]
        if (val !== undefined) {
          return val as ConfigurationSlotValue<
            ConfigurationSchemaForModel<CONF>,
            SLOT
          >
        }
        // ConfigOverrideMixin is always composed with models that provide
        // 'configuration'. Access it via plain-object cast to avoid propagating
        // MST internal symbol types ($stateTreeNodeType) into declaration files.
        const conf = (
          self as unknown as { configuration: AnyConfigurationModel }
        ).configuration
        // Read the live config value rather than going through
        // readConfObject (which clones object/array values into a fresh
        // reference on every call). Object/array-typed slots (e.g.
        // `stringArray`) are still MST nodes here — snapshot them so callers
        // never receive a Proxy (which can't cross postMessage into an RPC
        // worker); `getSnapshot` is a cached computed on the node, so it
        // stays referentially stable across reads until the node mutates,
        // same as returning `raw` would for scalars. Only jexl callbacks need
        // readConfObject's evaluation.
        const raw = (conf as unknown as Record<string, unknown>)[key]
        return (
          isCallbackValue(raw)
            ? readConfObject(conf, key)
            : isStateTreeNode(raw)
              ? getSnapshot(raw)
              : raw
        ) as ConfigurationSlotValue<ConfigurationSchemaForModel<CONF>, SLOT>
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setOverride(key: AnyKey, value: unknown) {
        if (value === undefined) {
          const { [key]: _, ...rest } = self.configOverrides
          self.configOverrides = rest
        } else {
          self.configOverrides = { ...self.configOverrides, [key]: value }
        }
      },
      /**
       * #action
       */
      clearOverride(key: AnyKey) {
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
