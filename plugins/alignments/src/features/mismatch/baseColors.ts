import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

// Per-base ASCII-keyed color map for Canvas2D mismatch + softclip-base draws.
// In modification mode, all bases collapse to the muted color so modifications
// stand out — matches the shader-side palette swap in
// GpuAlignmentsRenderer.writeUniforms.
export function buildBaseColorMap(state: RenderState): Record<number, string> {
  const { colors } = state
  const mutedBase = rgb255(colors.colorMutedSnpBase)
  return state.showModifications
    ? { 65: mutedBase, 67: mutedBase, 71: mutedBase, 84: mutedBase }
    : {
        65: rgb255(colors.colorBaseA),
        67: rgb255(colors.colorBaseC),
        71: rgb255(colors.colorBaseG),
        84: rgb255(colors.colorBaseT),
      }
}
