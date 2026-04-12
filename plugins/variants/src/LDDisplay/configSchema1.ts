import { makeLDDisplayConfigSchema } from './configSchemaFactory.ts'

/**
 * #config LDDisplay
 * extends
 * - [SharedLDDisplay](../sharedlddisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF() {
  return makeLDDisplayConfigSchema('LDDisplay')
}
