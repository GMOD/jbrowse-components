import { measureText } from '@jbrowse/core/util/measureText'
import { SvgHaloText } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk, bandPalette } from '@jbrowse/synteny-core'

import {
  INLINE_CHIP_OPACITY,
  INLINE_CHIP_PAD_PX,
  LABEL_FONT_SIZE,
  labelBoxTop,
} from '../laneHeader.ts'
import { GENE_LABEL_HALO_PX } from '../laneLabels.ts'

import type { LaneHeaderRow } from '../laneHeader.ts'

function SvgInlineChip({
  text,
  y,
  x,
  anchor,
}: {
  text: string
  y: number
  x: number
  anchor: 'start' | 'end'
}) {
  const width = measureText(text, LABEL_FONT_SIZE) + 2 * INLINE_CHIP_PAD_PX
  return (
    <rect
      data-testid="multiway-lane-inline-chip"
      x={
        anchor === 'start'
          ? x - INLINE_CHIP_PAD_PX
          : x - width + INLINE_CHIP_PAD_PX
      }
      y={labelBoxTop(y)}
      width={width}
      height={LABEL_FONT_SIZE}
      rx={2}
      fill={bandGroundColor()}
      fillOpacity={INLINE_CHIP_OPACITY}
    />
  )
}

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
          {row.inline ? (
            <SvgInlineChip text={row.label} x={2} y={row.y} anchor="start" />
          ) : null}
          <SvgHaloText {...text} x={2} y={row.y} fill={bandInk().text}>
            {row.label}
          </SvgHaloText>
          {row.scale ? (
            <>
              {row.inline ? (
                <SvgInlineChip
                  text={row.scale}
                  x={width - 2}
                  y={row.y}
                  anchor="end"
                />
              ) : null}
              <SvgHaloText
                {...text}
                x={width - 2}
                y={row.y}
                anchor="end"
                fill={bandPalette.text.secondary}
              >
                {row.scale}
              </SvgHaloText>
            </>
          ) : null}
        </g>
      ))}
    </>
  )
}
