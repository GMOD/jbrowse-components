import { SvgHaloText } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk, bandPalette } from '@jbrowse/synteny-core'

import { LABEL_FONT_SIZE } from '../laneHeader.ts'
import { GENE_LABEL_HALO_PX } from '../laneLabels.ts'

import type { LaneHeaderRow } from '../laneHeader.ts'

/**
 * The lane headers as an exported figure wants them: the name and where the
 * lane is looking on the left, its scale on the right, and nothing else.
 *
 * No measurement, because there is nothing to place after the label — the menu
 * affordance is a control and exists only on screen. The two x positions are
 * fixed; the on-screen headers estimate them.
 */
export function SvgLaneHeaders({
  rows,
  width,
  fontFamily,
}: {
  rows: LaneHeaderRow[]
  width: number
  fontFamily: string
}) {
  const text = {
    fontSize: LABEL_FONT_SIZE,
    fontFamily,
    halo: bandGroundColor(),
    haloWidth: GENE_LABEL_HALO_PX * 2,
  }
  return (
    <>
      {rows.map(row => (
        <g key={`header-${row.assemblyName}`}>
          <SvgHaloText {...text} x={2} y={row.y} fill={bandInk().text}>
            {row.label}
          </SvgHaloText>
          {row.scale ? (
            <SvgHaloText
              {...text}
              x={width - 2}
              y={row.y}
              anchor="end"
              fill={bandPalette.text.secondary}
            >
              {row.scale}
            </SvgHaloText>
          ) : null}
        </g>
      ))}
    </>
  )
}
