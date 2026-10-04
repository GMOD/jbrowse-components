import { SvgHaloText } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk, bandPalette } from '@jbrowse/synteny-core'

import { LABEL_FONT_SIZE } from '../laneHeader.ts'
import { GENE_LABEL_HALO_PX } from '../laneLabels.ts'

import type { LaneHeaderRow } from '../laneHeader.ts'

export function SvgLaneHeaders({
  rows,
  width,
}: {
  rows: LaneHeaderRow[]
  width: number
}) {
  const text = {
    fontSize: LABEL_FONT_SIZE,
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
