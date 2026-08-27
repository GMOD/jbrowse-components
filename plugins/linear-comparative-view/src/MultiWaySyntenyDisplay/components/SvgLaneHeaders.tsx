import { getFillProps } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE } from '../laneHeader.ts'

import type { LaneHeaderRow } from '../laneHeader.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

/**
 * The lane headers as an exported figure wants them: the name and where the
 * lane is looking on the left, its scale on the right, and nothing else.
 *
 * No measurement, because there is nothing to place after the label — the menu
 * affordance is a control and lives only on screen. The two x positions are
 * fixed, which is what the on-screen half's estimate was standing in for.
 */
export function SvgLaneHeaders({
  rows,
  width,
  palette,
}: {
  rows: LaneHeaderRow[]
  width: number
  palette: JBrowsePalette
}) {
  return (
    <>
      {rows.map(row => (
        <g key={`header-${row.assemblyName}`}>
          <text
            x={2}
            y={row.y}
            fontSize={LABEL_FONT_SIZE}
            {...getFillProps(palette.text.primary)}
          >
            {row.label}
          </text>
          {row.scale ? (
            <text
              x={width - 2}
              y={row.y}
              fontSize={LABEL_FONT_SIZE}
              textAnchor="end"
              {...getFillProps(palette.text.secondary)}
            >
              {row.scale}
            </text>
          ) : null}
        </g>
      ))}
    </>
  )
}
