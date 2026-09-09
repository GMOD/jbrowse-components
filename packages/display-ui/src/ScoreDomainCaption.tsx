import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { measureLegendText } from '@jbrowse/core/ui/measureLegendText'
import { stripAlpha } from '@jbrowse/core/util/svgColorProps'

import { formatScore } from './formatScore.ts'

export const SCORE_CAPTION_HEIGHT = 16

/**
 * The one-line `[min, max]` caption that stands in for a y axis where none can
 * be drawn — a scale whose bands are too short for tick labels, and a density
 * track whose rows each carry their own colour, so no single ramp describes
 * them. An axis stand-in rather than a key, which is why it is not a colour
 * scale and draws whether or not the legend does. Right-aligned to
 * `canvasWidth` at the top of the display.
 */
export default function ScoreDomainCaption({
  domain,
  scaleType,
  canvasWidth,
}: {
  domain: [number, number]
  scaleType: string
  canvasWidth: number
}) {
  const palette = usePalette()
  const suffix =
    scaleType === 'log' ? ' (log)' : scaleType === 'symlog' ? ' (symlog)' : ''
  const text = `[${formatScore(domain[0])}, ${formatScore(domain[1])}]${suffix}`
  const len = measureLegendText(text, 12)
  const xpos = Math.max(0, canvasWidth - len - 10)
  return (
    <g>
      <rect
        x={xpos - 3}
        y={0}
        width={len + 6}
        height={SCORE_CAPTION_HEIGHT}
        fill={stripAlpha(palette.background.paper)}
        fillOpacity={0.8}
      />
      <text y={12} x={xpos} fontSize={12} fill={palette.text.primary}>
        {text}
      </text>
    </g>
  )
}
