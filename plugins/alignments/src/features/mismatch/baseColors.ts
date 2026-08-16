import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ColorPalette, RGBColor } from '../../shaders/colors.ts'
import type { SnpBaseColors } from '@jbrowse/alignments-core'

// Every function here reads exactly these two fields, so a caller holding the
// palette — the coverage tooltip, which is not on a render path and has no
// `RenderState` — can reach the same table without building one.
type BaseColorState = Pick<RenderState, 'colors' | 'showModifications'>

/**
 * The five per-base colors after the modifications-mode mute: when
 * `showModifications` is on they all collapse to `colorMutedSnpBase` so the
 * overlay stands out.
 *
 * **The one place that rule is written**, for either backend. It used to be
 * four: a ternary in `buildBaseColorTupleMap`, another in `baseColorFallback`,
 * a `??` chain in `buildSnpBaseColors`, and five uniform writes in
 * `GpuAlignmentsRenderer.writeUniforms` — the GPU one tied to the rest by a
 * comment saying to keep them in step. It had already gone missing from three
 * canvas call sites once (see the fallback below), and a miss is a base painted
 * its own colour on one backend and grey on the other, in the one mode whose
 * point is that bases recede.
 */
export function effectiveBaseColors(state: BaseColorState) {
  const { colors } = state
  const muted = state.showModifications ? colors.colorMutedSnpBase : undefined
  return {
    A: muted ?? colors.colorBaseA,
    C: muted ?? colors.colorBaseC,
    G: muted ?? colors.colorBaseG,
    T: muted ?? colors.colorBaseT,
    N: muted ?? colors.colorBaseN,
  }
}

// Per-base canvas colors (mismatch + softclip-base draws), keyed by
// uppercase-ASCII base code. RGBColor tuples so mismatch draws can apply
// per-mismatch alpha via rgba255(); softclip-base draws wrap in rgb255(). N
// (78) has its own color; other non-A/C/G/T/N bytes take `baseColorFallback`.
export function buildBaseColorTupleMap(
  state: BaseColorState,
): Record<number, RGBColor> {
  const c = effectiveBaseColors(state)
  return { 65: c.A, 67: c.C, 71: c.G, 84: c.T, 78: c.N }
}

// The color a byte that is not A/C/G/T/N takes. Reachable in ordinary data:
// BAM's 4-bit alphabet is `=ACMGRSVTWYHKDBN`, so IUPAC ambiguity codes and '='
// both reach the per-base draws, and the extractors only upper-case the byte
// (`& ~0x20`) rather than folding it to N.
//
// It is N's color, muted or not, rather than a second reading of
// `showModifications`: the GPU reaches this same case through mismatch.slang's
// `default: colorBaseN`, so the fallback IS whatever N resolved to. Spelling it
// as its own ternary is what once painted a stray IUPAC base blue on Canvas2D
// while the GPU painted it grey.
export function baseColorFallback(state: BaseColorState): RGBColor {
  return effectiveBaseColors(state).N
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
// Memoized on the two things it reads, for the reason `lineCss` in
// linkedReads/drawCanvas.ts is: three passes call this and each calls it per
// section per block, so a grouped display rebuilt a 256-entry array up to 360
// times a frame to hold the same six strings. Not at module scope — the palette
// is THEMED, and baking it at import time is how a dark-mode pileup came to draw
// connectors in the light palette's colors.
//
// `showModifications` is in the key because it is the other half of
// `effectiveBaseColors`: it mutes all five bases, so a palette-only key would
// serve the unmuted table for the whole session after one modifications toggle.
let baseCssMemo:
  | { colors: ColorPalette; showModifications: boolean; table: string[] }
  | undefined

export function buildBaseCssMap(state: BaseColorState): string[] {
  if (
    baseCssMemo?.colors !== state.colors ||
    baseCssMemo.showModifications !== state.showModifications
  ) {
    const tuples = buildBaseColorTupleMap(state)
    const table = new Array<string>(256).fill(rgb255(baseColorFallback(state)))
    for (const [code, tuple] of Object.entries(tuples)) {
      table[Number(code)] = rgb255(tuple)
    }
    baseCssMemo = {
      colors: state.colors,
      showModifications: state.showModifications,
      table,
    }
  }
  return baseCssMemo.table
}

// The palette for Canvas2D SNP-coverage segment draws.
export function buildSnpBaseColors(state: BaseColorState): SnpBaseColors {
  const c = effectiveBaseColors(state)
  return {
    baseA: rgb255(c.A),
    baseC: rgb255(c.C),
    baseG: rgb255(c.G),
    baseT: rgb255(c.T),
    baseN: rgb255(c.N),
  }
}
