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
