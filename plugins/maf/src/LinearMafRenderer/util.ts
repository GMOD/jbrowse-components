import { alpha, getContrastText } from '@jbrowse/core/ui/palette'

import type { LegendItem } from '@jbrowse/core/ui'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * Theme-derived color set fed to the MAF cell-color resolver. Centralizing
 * the theme lookup here keeps `resolveCellColor`, the GPU encoder, and the
 * Canvas2D path consistent — and gives users one place to override colors
 * via custom themes (no more hardcoded fallbacks in the renderer).
 */
export interface MafColorPalette {
  colorForBase: Record<string, string>
  matchColor: string
  gapColor: string
  mismatchOffColor: string
  unknownBaseColor: string
  insertionColor: string
  /** Color of the single/double bridge lines drawn for `e`-line rows */
  bridgeLineColor: string
  /** Pale fill for `M`-status (missing-data) bridged rows, à la UCSC */
  missingDataColor: string
}

export function getColorBaseMap(palette: JBrowsePalette) {
  const { bases } = palette
  return {
    a: bases.A.main,
    c: bases.C.main,
    g: bases.G.main,
    t: bases.T.main,
    n: bases.N.main,
  }
}

export function getMafColorPalette(palette: JBrowsePalette): MafColorPalette {
  return {
    colorForBase: getColorBaseMap(palette),
    matchColor: palette.action.disabledBackground,
    gapColor: palette.deletion,
    mismatchOffColor: palette.mutedSnpBase,
    unknownBaseColor: palette.text.primary,
    insertionColor: palette.insertion,
    bridgeLineColor: palette.text.secondary,
    missingDataColor: palette.missingData,
  }
}

/**
 * The theme's CDS reading-frame colors as plain CSS strings, indexed the same
 * as `palette.framesCDS`: slot 0 unused, slots 1..3 the `+`-strand frames,
 * 4..6 the `−`-strand ones. Index it with `frameColorIndex`, never by hand.
 */
export function getFrameColors(
  palette: JBrowsePalette,
): (string | undefined)[] {
  return palette.framesCDS.map(c => c?.main)
}

/**
 * The `getFrameColors` slot for a `mafFrames` record's `frame` (0/1/2) and
 * `strand`.
 *
 * The single place the palette's layout is known, and it exists because that
 * layout was previously known in four: the marker builder computed
 * `(frame % 3) + 1` and negated it on `−`, the painter looked it up with
 * `Array.at` so the negation wrapped to the far end, the palette itself put
 * slots 4..6 in reverse so the wrap landed on the matching hue, and the legend
 * read 1..3 straight. Every one of those had to be right for a strip to be the
 * color the key claims, and three of them were arithmetic no reader could check
 * without the other two in front of them.
 *
 * The mirroring is the *point*, not an accident: `+` frame 0 and `−` frame 0
 * come out the same color, so one reading frame reads as one color across
 * species and strands. Stating it as `6 - frame` rather than as a negative
 * index is what makes that visible here instead of implied by a palette table
 * three files away.
 */
export function frameColorIndex(frame: number, strand: number): number {
  const f = ((frame % 3) + 3) % 3
  return strand === -1 ? 6 - f : f + 1
}

/**
 * The color key for the CDS-frame strip, built through the very indexer
 * `drawMafAnnotations` paints with — same rule as the codon key below.
 *
 * The strip had no key at all, on screen or exported, and could not have had
 * one: `legendItems` dispatches on `activeRowRendering`, and the strip is an
 * *overlay* that draws over whichever rendering won, so no branch of that
 * dispatch is ever it. Three saturated colors on every species row with nothing
 * anywhere saying they mean reading frame — a reader's first guess is strand, or
 * gene identity, and both are wrong.
 *
 * Three entries, not six, because `frameColorIndex` maps both strands of a
 * frame onto one color: a six-row key would be three duplicated pairs claiming
 * a distinction the picture does not draw. `+` is passed for that reason and
 * not because the key is about `+` genes.
 *
 * Labelled by codon position rather than by the raw `frame` number, which is
 * 0-based and which the hover tooltip deliberately does not show at all.
 */
export function getFrameLegendItems(palette: JBrowsePalette): LegendItem[] {
  const colors = getFrameColors(palette)
  const color = (frame: number) => colors[frameColorIndex(frame, 1)]
  return [
    { label: 'CDS frame: 1st codon base', color: color(0) },
    { label: '2nd codon base', color: color(1) },
    { label: '3rd codon base', color: color(2) },
  ]
}

/**
 * Codon-view cell colors: nonsynonymous changes get a clear highlight, silent
 * (synonymous) changes a faint fill, stops the error color, and conserved codons
 * no fill (the cell stays clean). The amino-acid glyph drawn on top uses the
 * primary text color. Theme-derived so it's available headless for SVG export.
 *
 * Dark mode uses higher alphas: a translucent fill composites toward the (dark)
 * track background, so the light-mode synonymous blue at 0.18 nearly vanishes
 * there — the per-mode alphas keep every change category legible on both.
 */
export function getCodonColors(palette: JBrowsePalette) {
  const dark = palette.mode === 'dark'
  return {
    fill: {
      same: undefined,
      syn: alpha(palette.codonSynonymous, dark ? 0.4 : 0.18),
      nonsyn: alpha(palette.codonNonsynonymous, dark ? 0.68 : 0.55),
      stop: alpha(palette.codonStop, dark ? 0.72 : 0.6),
    },
    text: palette.text.primary,
  }
}

/**
 * The color key for the codon view, built from the very fills `getCodonColors`
 * hands the painter.
 *
 * It has to be, because those fills are alpha-composited: the legend used to
 * name the raw theme colors, so the faint synonymous fill (alpha 0.18 in light
 * mode) showed in the key as a saturated blue no cell on screen is — the
 * reader's decoder was several shades off the thing it decoded.
 *
 * `same` is deliberately absent: a conserved codon takes no fill, so it has no
 * swatch to show.
 */
export function getCodonLegendItems(palette: JBrowsePalette): LegendItem[] {
  const { fill } = getCodonColors(palette)
  return [
    { label: 'Nonsynonymous', color: fill.nonsyn },
    { label: 'Synonymous', color: fill.syn },
    { label: 'Stop', color: fill.stop },
  ]
}

export function getContrastBaseMap(palette: JBrowsePalette) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(palette)).map(([key, value]) => [
      key,
      getContrastText(value),
    ]),
  )
}
