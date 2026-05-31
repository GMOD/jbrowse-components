import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { RGBColor } from '../../LinearAlignmentsDisplay/shaders/colors.ts'
import type { CigarOpDrawColors } from '@jbrowse/alignments-core'

// Canvas-side equivalents of the GPU palette swap in GpuAlignmentsRenderer.writeUniforms.
// When showModifications is true, all per-base colors collapse to colorMutedSnpBase (grey)
// so that modification overlays stand out. Any new canvas feature that renders per-base
// colors must call one of these builders rather than inlining the palette selection.

// Single source for per-base canvas colors (mismatch + softclip-base draws),
// keyed by uppercase-ASCII base code. Returns RGBColor tuples so mismatch draws
// can apply per-mismatch alpha via rgba255(); softclip-base draws wrap in
// rgb255(). Non-A/C/G/T bases (e.g. N) fall back to colorMutedSnpBase at the
// call sites.
export function buildBaseColorTupleMap(
  state: RenderState,
): Record<number, RGBColor> {
  const { colors } = state
  const muted = colors.colorMutedSnpBase
  return state.showModifications
    ? { 65: muted, 67: muted, 71: muted, 84: muted }
    : {
        65: colors.colorBaseA,
        67: colors.colorBaseC,
        71: colors.colorBaseG,
        84: colors.colorBaseT,
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
