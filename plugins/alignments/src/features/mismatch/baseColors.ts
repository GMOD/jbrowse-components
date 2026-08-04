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
// rgb255(). N (78) has its own color; other non-A/C/G/T/N bytes take
// `baseColorFallback`. Under showModifications every base mutes to grey.
export function buildBaseColorTupleMap(
  state: RenderState,
): Record<number, RGBColor> {
  const { colors } = state
  const muted = colors.colorMutedSnpBase
  return state.showModifications
    ? { 65: muted, 67: muted, 71: muted, 84: muted, 78: muted }
    : {
        65: colors.colorBaseA,
        67: colors.colorBaseC,
        71: colors.colorBaseG,
        84: colors.colorBaseT,
        78: colors.colorBaseN,
      }
}

// The color a byte that is not A/C/G/T/N takes. Reachable in ordinary data:
// BAM's 4-bit alphabet is `=ACMGRSVTWYHKDBN`, so IUPAC ambiguity codes and '='
// both reach the per-base draws, and the extractors only upper-case the byte
// (`& ~0x20`) rather than folding it to N.
//
// Must mute under showModifications. The GPU reaches this same case through
// mismatch.slang's `default: colorBaseN`, and writeUniforms has ALREADY swapped
// colorBaseN to grey by then — so a call site reading the raw `colors.colorBaseN`
// painted a stray IUPAC base blue on Canvas2D while the GPU painted it grey.
export function baseColorFallback(state: RenderState): RGBColor {
  return state.showModifications
    ? state.colors.colorMutedSnpBase
    : state.colors.colorBaseN
}

// The same palette as CSS strings, in a 256-entry table indexed by the raw base
// byte, with the fallback above pre-filled. Two things follow: the byte indexes
// the table directly, so no call site re-spells the non-ACGTN fallback (which
// is how the mute above went missing from three of them), and a draw loop reads
// a string rather than formatting one per cell. Mirrors `qualityCssColors`
// (perBaseQuality/colors.ts), the same table for the quality ramp.
//
// The formatting is what the table removes, not the `fillStyle` assignment —
// these passes emit one entry per visible base per read, the largest arrays the
// display produces, so an `rgb()` template literal per cell is real allocation.
// Whether de-duplicating the *assignment* on top of that pays (as `drawReads`
// does with its `lastFill`) is unmeasured here.
export function buildBaseCssMap(state: RenderState): string[] {
  const tuples = buildBaseColorTupleMap(state)
  const table = new Array<string>(256).fill(rgb255(baseColorFallback(state)))
  for (const [code, tuple] of Object.entries(tuples)) {
    table[Number(code)] = rgb255(tuple)
  }
  return table
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
    baseN: base ?? rgb255(colors.colorBaseN),
    mismatch: '',
    deletion: rgb255(colors.colorDeletion),
    insertion: '',
  }
}
