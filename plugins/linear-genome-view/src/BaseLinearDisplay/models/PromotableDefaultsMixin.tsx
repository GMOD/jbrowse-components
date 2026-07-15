import {
  ConfigurationReference,
  clearPromotedDefaults,
  getDisplayTypeDefaultChanges,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { TrackConfigChange } from '@jbrowse/core/util'

/**
 * #stateModel PromotableDefaultsMixin
 * #category display
 *
 * The `AbstractDisplayModel` side of `promotable` config slots (see
 * `@jbrowse/core/configuration` `promotableDefaults.ts`): exposes the
 * session-default badge hooks the track selector calls polymorphically on any
 * display. A display whose config schema has any `promotable` slot composes
 * this so the "affected by a session default" badge and its "clear default"
 * action work without re-implementing the two delegations per display type.
 *
 * It re-declares the `type`/`configuration`/`ignorePromotedDefaults` members it
 * reads (`compose` merges them last-wins with the concrete display's own
 * declarations, all originating in BaseDisplay) so `self` is typed as a
 * promotable display and the two delegations stay cast-free.
 */
export default function PromotableDefaultsMixin(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .model({
      type: types.string,
      configuration: ConfigurationReference(configSchema),
      ignorePromotedDefaults: types.stripDefault(types.boolean, false),
    })
    .actions(self => ({
      setIgnorePromotedDefaults(flag: boolean) {
        self.ignorePromotedDefaults = flag
      },
    }))
    .views(self => ({
      /**
       * #method
       * Effective config differences a track following the default inherits from
       * session-wide defaults (distinct from per-track config edits /
       * trackConfigDeltas). Drives the "affected by a session default" badge.
       */
      displayTypeDefaultChanges(): TrackConfigChange[] {
        return getDisplayTypeDefaultChanges(self)
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Clear the session-wide defaults reported by `displayTypeDefaultChanges` so
       * this display (and its siblings of the same type) revert to their config
       * values. Backs the "clear default" action on the selector badge.
       */
      clearDisplayTypeDefaults() {
        clearPromotedDefaults(self)
      },
    }))
}
