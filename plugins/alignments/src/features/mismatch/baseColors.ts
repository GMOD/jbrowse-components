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
 * **The one place that rule is written**, for either backend — every table and
 * palette below reads it, and so does `GpuAlignmentsRenderer.writeUniforms`,
 * which used to spell the mute again across five uniform writes under a comment
 * saying to keep them in step. A miss is a base painted its own colour on one
 * backend and grey on the other, in the one mode whose point is that bases
 * recede.
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

// One 256-entry table per palette, filled from a five-entry map so both tables
// below are built the same way and index the raw base byte directly.
//
// The fill is the color a byte that is not A/C/G/T/N takes, and it is reachable
// in ordinary data: BAM's 4-bit alphabet is `=ACMGRSVTWYHKDBN`, so IUPAC
// ambiguity codes and '=' both reach the per-base draws, and the extractors only
// upper-case the byte (`& ~0x20`) rather than folding it to N.
//
// It is N's own entry, muted or not, rather than a second reading of
// `showModifications`: the GPU reaches this same case through mismatch.slang's
// `default: colorBaseN`, so the fallback IS whatever N resolved to. Spelling it
// as its own ternary is what once painted a stray IUPAC base blue on Canvas2D
// while the GPU painted it grey.
function baseTable<T>(state: BaseColorState, of: (c: RGBColor) => T): T[] {
  const c = effectiveBaseColors(state)
  const table = new Array<T>(256).fill(of(c.N))
  table[65] = of(c.A)
  table[67] = of(c.C)
  table[71] = of(c.G)
  table[84] = of(c.T)
  table[78] = of(c.N)
  return table
}

// Memo shared by both tables, since a caller wanting one of them at a given
// palette is about to want the other: `drawMismatches` reads the CSS entry for
// an opaque mismatch and the tuple entry for a faded one, and which it needs is
// per mismatch.
let tableMemo:
  | {
      colors: ColorPalette
      showModifications: boolean
      css: string[]
      tuples: RGBColor[]
    }
  | undefined

function baseTables(state: BaseColorState) {
  if (
    tableMemo?.colors !== state.colors ||
    tableMemo.showModifications !== state.showModifications
  ) {
    tableMemo = {
      colors: state.colors,
      showModifications: state.showModifications,
      css: baseTable(state, rgb255),
      tuples: baseTable(state, c => c),
    }
  }
  return tableMemo
}

// The palette as CSS strings, in a 256-entry table indexed by the raw base byte
// with the fallback above pre-filled. Two things follow: the byte indexes the
// table directly, so no call site re-spells the non-ACGTN fallback (which is how
// the mute above went missing from three of them), and a draw loop reads a
// string rather than formatting one per cell. Mirrors `qualityCssColors`
// (perBaseQuality/colors.ts), the same table for the quality ramp.
//
// The formatting is what the table removes, not the `fillStyle` assignment —
// these passes emit one entry per visible base per read, the largest arrays the
// display produces, so an `rgb()` template literal per cell is real allocation.
// Whether de-duplicating the *assignment* on top of that pays (as `drawReads`
// does with its `lastFill`) is unmeasured here.
//
// Memoized for the reason `lineCss` in linkedReads/drawCanvas.ts is: three
// passes call this and each calls it per section per block, so a grouped display
// rebuilt a 256-entry array up to 360 times a frame to hold the same six
// strings. Not at module scope — the palette is THEMED, and baking it at import
// time is how a dark-mode pileup came to draw connectors in the light palette's
// colors.
//
// `showModifications` is in the key because it is the other half of
// `effectiveBaseColors`: it mutes all five bases, so a palette-only key would
// serve the unmuted table for the whole session after one modifications toggle.
export function buildBaseCssMap(state: BaseColorState): string[] {
  return baseTables(state).css
}

// The same table as RGB tuples, for the one draw that applies a per-mark alpha
// (`drawMismatches`, through `rgba255`). A table rather than the five-entry map
// it used to be, so the faded branch stops re-spelling the fallback with a `??`
// — the exact thing the CSS table exists to prevent, left in the one call site
// that needed both.
export function buildBaseTupleMap(state: BaseColorState): RGBColor[] {
  return baseTables(state).tuples
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
