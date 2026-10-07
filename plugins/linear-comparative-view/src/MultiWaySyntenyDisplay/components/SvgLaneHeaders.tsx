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

const BADGE_PAD_PX = 3

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
      {rows.map(row => {
        const badge = row.against ? `vs ${row.against}` : undefined
        const badgeWidth = badge
          ? measureText(badge, LABEL_FONT_SIZE) + 2 * BADGE_PAD_PX
          : 0
        const labelX = badge ? 2.5 + badgeWidth + 4 : 2
        return (
          <g key={`header-${row.assemblyName}`}>
            {badge ? (
              <>
                <rect
                  x={2.5}
                  y={labelBoxTop(row.y) - 0.5}
                  width={badgeWidth}
                  height={LABEL_FONT_SIZE + 1}
                  rx={2}
                  fill={bandGroundColor()}
                  stroke={bandInk().text}
                />
                <text
                  x={2.5 + BADGE_PAD_PX}
                  y={row.y}
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight={600}
                  fill={bandInk().text}
                >
                  {badge}
                </text>
              </>
            ) : null}
            {row.inline ? (
              <SvgInlineChip
                text={row.label}
                x={labelX}
                y={row.y}
                anchor="start"
              />
            ) : null}
            <SvgHaloText {...text} x={labelX} y={row.y} fill={bandInk().text}>
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
        )
      })}
    </>
  )
}
