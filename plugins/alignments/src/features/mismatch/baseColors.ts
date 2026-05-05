import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { CigarOpDrawColors } from '@jbrowse/alignments-core'
import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

// Canvas-side equivalents of the GPU palette swap in GpuAlignmentsRenderer.writeUniforms.
// When showModifications is true, all per-base colors collapse to colorMutedSnpBase (grey)
// so that modification overlays stand out. Any new canvas feature that renders per-base
// colors must call one of these builders rather than inlining the palette selection.

// Per-base ASCII-keyed color map for Canvas2D mismatch + softclip-base draws.
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

// CigarOpDrawColors palette for Canvas2D SNP-coverage segment draws.
export function buildCigarOpDrawColors(state: RenderState): CigarOpDrawColors {
  const { colors } = state
  const base = state.showModifications
    ? rgb255(colors.colorMutedSnpBase)
    : undefined
  return {
    baseA: base ?? rgb255(colors.colorBaseA),
    baseC: base ?? rgb255(colors.colorBaseC),
    baseG: base ?? rgb255(colors.colorBaseG),
    baseT: base ?? rgb255(colors.colorBaseT),
    mismatch: '',
    deletion: rgb255(colors.colorDeletion),
    insertion: '',
  }
}
