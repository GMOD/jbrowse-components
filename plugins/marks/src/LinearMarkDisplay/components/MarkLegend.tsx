import {
  GRADIENT_LEGEND_HEIGHT,
  GRADIENT_LEGEND_WIDTH,
  LEGEND_ROW_HEIGHT,
  SvgColorLegend,
  SvgGradientLegend,
  legendEntries,
} from '@jbrowse/core/ui'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { toP } from '@jbrowse/wiggle-core'

import type { MarkLegendSection } from '../legend.ts'

const RAMP_STOPS = 8
// A titled gradient box grows by its title line; see SvgGradientLegend.
const RAMP_BOX_HEIGHT = GRADIENT_LEGEND_HEIGHT + 14 + 4

/**
 * The colour keys as one `<g>`, categorical tables as swatch rows and ramps
 * as gradient bars, stacked top to bottom — drawn on screen inside a
 * `FloatingSvgOverlay` and in the export inside the frame, so the two cannot
 * disagree.
 */
export default function MarkLegend({
  sections,
  canvasWidth,
  maxHeight,
  displayId,
  onDismiss,
}: {
  sections: MarkLegendSection[]
  canvasWidth: number
  maxHeight: number
  displayId: string
  onDismiss?: () => void
}) {
  const entries = legendEntries({
    sections: sections.flatMap(s =>
      s.scale.kind === 'categorical'
        ? [
            {
              id: `mark-${s.markIndex}`,
              title: s.scale.field,
              items: s.scale.entries.map(e => ({
                label: e.label,
                color: abgrToCssRgba(e.color),
              })),
            },
          ]
        : [],
    ),
  })
  const rowsHeight = Math.min(maxHeight, entries.length * LEGEND_ROW_HEIGHT)
  const ramps = sections.filter(s => s.scale.kind === 'ramp')
  return (
    <g data-testid="mark-legend">
      {entries.length > 0 ? (
        <SvgColorLegend
          canvasWidth={canvasWidth}
          maxHeight={maxHeight}
          onDismiss={onDismiss}
          entries={entries}
        />
      ) : null}
      {ramps.map((s, i) =>
        s.scale.kind === 'ramp' ? (
          <SvgGradientLegend
            key={s.markIndex}
            gradientId={`${displayId}-mark-${s.markIndex}-ramp`}
            x={Math.max(0, canvasWidth - GRADIENT_LEGEND_WIDTH - 4)}
            y={rowsHeight + i * RAMP_BOX_HEIGHT}
            title={s.scale.field}
            stops={stopsFromRampLut(s.scale.lut, RAMP_STOPS)}
            labels={[
              { text: String(toP(s.scale.domain[0], 3)), position: 'start' },
              { text: String(toP(s.scale.domain[1], 3)), position: 'end' },
            ]}
          />
        ) : null,
      )}
    </g>
  )
}
