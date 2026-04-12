import { makeLDDisplayConfigSchema } from './configSchemaFactory.ts'

/**
 * #config LDTrackDisplay
 * Display configuration for pre-computed LD data on LDTrack
 * extends
 * - [SharedLDDisplay](../sharedlddisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF() {
  return makeLDDisplayConfigSchema('LDTrackDisplay')
}
