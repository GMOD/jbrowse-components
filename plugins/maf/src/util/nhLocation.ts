import type { FileLocation } from '@jbrowse/core/util'

/**
 * The `nhLocation` placeholder meaning "no guide tree configured", read the way
 * `aliasUtils` reads its `/path/to/my/...` locations. The reading lives here
 * once; the four schema defaults stay literal, because the config-doc generator
 * renders a default from the source text and would otherwise publish
 * `UNCONFIGURED_NH_URI` to users who need the path. `nhLocation.test.ts` pins
 * the four against this.
 */
export const UNCONFIGURED_NH_URI = '/path/to/my.nh'

export function isUnconfiguredNhLocation(location: FileLocation) {
  return 'uri' in location && location.uri === UNCONFIGURED_NH_URI
}
