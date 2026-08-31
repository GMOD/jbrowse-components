import type { UriLocation } from '@jbrowse/core/util'

/**
 * The two cross-view navigation fields, spread onto a row/sample only when set.
 *
 * Spread rather than assigned: an explicit `assemblyName: undefined` is not an
 * absent key to `setSamples`' `deepEqual` guard or to the `rpcProps()` cache
 * keys `samples` feeds, so writing it unconditionally makes a row with no
 * navigation target compare unequal to itself. Converted in three directions
 * (config entry → `Sample` → `MafSource` → `Sample`), so the rule lives once.
 */
export function navigationFields(source: {
  assemblyName?: string
  assemblyConfigLocation?: UriLocation
}) {
  return {
    ...(source.assemblyName ? { assemblyName: source.assemblyName } : {}),
    ...(source.assemblyConfigLocation
      ? { assemblyConfigLocation: source.assemblyConfigLocation }
      : {}),
  }
}
