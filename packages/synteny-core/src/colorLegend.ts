import { continuousRampConfig, divergingIdentityRgb } from './colorRamps.ts'
import { colorSchemes } from './colorUtils.ts'

import type { Rgb } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'

const rgbCss = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`

// Sample a ramp at 9 stops into a left→right CSS gradient — the legend swatch
// for a continuous color-by mode, drawn from the exact same toRgb the renderer
// uses so the two can't disagree.
function gradientCss(toRgb: (norm: number) => Rgb) {
  const stops: string[] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    stops.push(`${rgbCss(toRgb(t))} ${Math.round(t * 100)}%`)
  }
  return `linear-gradient(to right, ${stops.join(',')})`
}

export interface ColorChip {
  color: string
  label: string
}

// A continuous mode maps to a gradient ramp with domain labels; the structural
// modes (default/strand) map to a set of discrete labeled chips — including the
// CIGAR indel colors those modes overlay, which a single swatch can't convey.
export type ColorBySwatchSpec =
  | { kind: 'ramp'; background: string; minLabel?: string; maxLabel?: string }
  | { kind: 'chips'; chips: ColorChip[] }

const { cigarColors: defaultCigar } = colorSchemes.default
const { posColor, negColor, cigarColors: strandCigar } = colorSchemes.strand

// default/strand draw block colors plus CIGAR ops; enumerate every color those
// modes can paint so the legend matches the canvas. Derived from the shared
// scheme constants so they can't drift from the renderer.
const DEFAULT_CHIPS: ColorChip[] = [
  { color: defaultCigar.M, label: 'match' },
  { color: defaultCigar.I, label: 'insertion' },
  { color: defaultCigar.D, label: 'deletion' },
  { color: defaultCigar.N, label: 'skip' },
]
const STRAND_CHIPS: ColorChip[] = [
  { color: posColor, label: 'forward' },
  { color: negColor, label: 'reverse' },
  { color: strandCigar.I, label: 'insertion' },
  { color: strandCigar.D, label: 'del/skip' },
]

// Point-based views (dotplot) paint each alignment a single flat color and never
// draw CIGAR ops, so their default/strand legends drop the indel chips the
// ribbon-based synteny view shows. The dotplot default is plain black (its
// conventional point color), not the ribbon's red match.
const DOTPLOT_DEFAULT_CHIPS: ColorChip[] = [
  { color: '#000', label: 'alignment' },
]
const DOTPLOT_STRAND_CHIPS: ColorChip[] = [
  { color: posColor, label: 'forward' },
  { color: negColor, label: 'reverse' },
]

// Short human-readable title for the floating legend header.
export const colorByShortLabel: Record<SyntenyColorBy, string> = {
  default: 'Default',
  strand: 'Strand',
  query: 'Query name',
  target: 'Target name',
  reference: 'Reference name',
  identity: 'Identity',
  identityDiverging: 'Identity (diverging)',
  meanQueryIdentity: 'Mean query identity',
  meanQueryMappingQuality: 'Mean query MAPQ',
  mappingQuality: 'Mapping quality',
}

// Legend spec for a color-by mode: a gradient ramp for continuous modes, or a
// set of labeled chips for the structural modes. Returns undefined for the
// per-name categorical modes (query/target), which have no fixed legend.
// `drawsCigar` is true for the ribbon-based synteny view (which paints CIGAR
// ops); the point-based dotplot passes false to omit the indel chips.
export function getColorBySwatch(
  colorBy: SyntenyColorBy,
  { drawsCigar = true }: { drawsCigar?: boolean } = {},
): ColorBySwatchSpec | undefined {
  switch (colorBy) {
    case 'identity':
    case 'meanQueryIdentity':
      return {
        kind: 'ramp',
        background: gradientCss(continuousRampConfig.identity.toRgb),
        minLabel: '0%',
        maxLabel: '100%',
      }
    case 'mappingQuality':
      return {
        kind: 'ramp',
        background: gradientCss(continuousRampConfig.mappingQuality.toRgb),
        minLabel: '0',
        maxLabel: '60',
      }
    case 'meanQueryMappingQuality':
      return {
        kind: 'ramp',
        background: gradientCss(
          continuousRampConfig.meanQueryMappingQuality.toRgb,
        ),
        minLabel: 'weak',
        maxLabel: 'strong',
      }
    case 'identityDiverging':
      return {
        kind: 'ramp',
        background: gradientCss(t => divergingIdentityRgb(t)),
        minLabel: 'divergent',
        maxLabel: 'conserved',
      }
    case 'strand':
      return {
        kind: 'chips',
        chips: drawsCigar ? STRAND_CHIPS : DOTPLOT_STRAND_CHIPS,
      }
    case 'default':
      return {
        kind: 'chips',
        chips: drawsCigar ? DEFAULT_CHIPS : DOTPLOT_DEFAULT_CHIPS,
      }
    case 'query':
    case 'target':
    case 'reference':
      return undefined
  }
}
