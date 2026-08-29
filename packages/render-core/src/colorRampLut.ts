import { RAMP_LUT_ENTRIES } from './shaders/colorRampLut.generated.ts'

import type { GpuHal } from './hal/index.ts'

/**
 * Entries in a colour-ramp LUT, and so the width of the texture every ramp
 * consumer binds. Off the shader that samples it: `rampColor` divides by this
 * to land entry i on its own texel center, so a table built to a different
 * number is a half-shade of drift at every entry.
 */
export const COLOR_RAMP_LUT_ENTRIES = RAMP_LUT_ENTRIES

/**
 * Upload a 256-entry RGBA colour-ramp LUT as each named pass's 256×1 texture —
 * the runtime half of the shared ramp mechanism whose shader half is
 * `shaders/colorRampLut.slang`. HiC, LD (whose two shader variants are the
 * reason this takes a pass list) and wiggle density all put their ramps behind
 * their samplers through this one call; each keeps its own scale and its own
 * LUT contents.
 */
export function uploadColorRampLut(
  hal: GpuHal,
  ramp: Uint8Array,
  passIds: readonly string[],
) {
  if (ramp.length !== COLOR_RAMP_LUT_ENTRIES * 4) {
    throw new Error(
      `uploadColorRampLut: expected a ${COLOR_RAMP_LUT_ENTRIES}-entry RGBA LUT ` +
        `(${COLOR_RAMP_LUT_ENTRIES * 4} bytes), got ${ramp.length} bytes`,
    )
  }
  for (const passId of passIds) {
    hal.uploadTexture(passId, ramp, COLOR_RAMP_LUT_ENTRIES, 1)
  }
}
