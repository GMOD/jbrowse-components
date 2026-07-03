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

export interface ColorBySwatchSpec {
  background: string
  minLabel?: string
  maxLabel?: string
}

// CSS background for a color-by legend swatch, plus the min/max domain labels
// where the axis is bounded. Returns undefined for the per-name categorical
// modes (query/target), which have no fixed legend.
export function getColorBySwatch(
  colorBy: SyntenyColorBy,
): ColorBySwatchSpec | undefined {
  switch (colorBy) {
    case 'identity':
    case 'meanQueryIdentity':
      return {
        background: gradientCss(continuousRampConfig.identity.toRgb),
        minLabel: '0%',
        maxLabel: '100%',
      }
    case 'mappingQuality':
      return {
        background: gradientCss(continuousRampConfig.mappingQuality.toRgb),
        minLabel: '0',
        maxLabel: '60',
      }
    case 'meanQueryMappingQuality':
      return {
        background: gradientCss(
          continuousRampConfig.meanQueryMappingQuality.toRgb,
        ),
        minLabel: 'weak',
        maxLabel: 'strong',
      }
    case 'identityDiverging':
      return {
        background: gradientCss(t => divergingIdentityRgb(t)),
        minLabel: 'divergent',
        maxLabel: 'conserved',
      }
    case 'strand':
      return {
        background: `linear-gradient(to right, ${colorSchemes.strand.posColor} 0 50%, ${colorSchemes.strand.negColor} 50% 100%)`,
        minLabel: 'fwd',
        maxLabel: 'rev',
      }
    case 'default':
      return { background: colorSchemes.default.cigarColors.M }
    case 'query':
    case 'target':
      return undefined
  }
}
