import { measureText, truncateToWidth } from '@jbrowse/core/util/measureText'
import { SvgHaloText } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk, bandPalette } from '@jbrowse/synteny-core'

import {
  BADGE_PAD_PX,
  HEADER_GAP_PX,
  HEADER_INSET_PX,
  INLINE_CHIP_OPACITY,
  INLINE_CHIP_PAD_PX,
  LABEL_FONT_SIZE,
  LANE_COLOR_SWATCH_PX,
  LANE_COLOR_TINT,
  changesChipWidth,
  headerText,
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

function SvgColorChip({
  text,
  y,
  x,
  color,
}: {
  text: string
  y: number
  x: number
  color: string
}) {
  const box = {
    x: x - INLINE_CHIP_PAD_PX,
    y: labelBoxTop(y),
    width: measureText(text, LABEL_FONT_SIZE) + 2 * INLINE_CHIP_PAD_PX,
    height: LABEL_FONT_SIZE,
    rx: 2,
  }
  return (
    <g data-testid="multiway-lane-color-chip">
      <rect {...box} fill={bandGroundColor()} />
      <rect {...box} fill={color} fillOpacity={LANE_COLOR_TINT} />
    </g>
  )
}

function SvgChangesChip({
  text,
  anchor,
  right,
  width,
  y,
}: {
  text: string
  anchor: string
  right: number
  width: number
  y: number
}) {
  return (
    <g data-testid="multiway-lane-changes">
      <title>{`against ${anchor}`}</title>
      <rect
        x={right - width}
        y={labelBoxTop(y) - 0.5}
        width={width}
        height={LABEL_FONT_SIZE + 1}
        rx={2}
        fill={bandGroundColor()}
        stroke={bandPalette.text.secondary}
      />
      <text
        x={right - width + INLINE_CHIP_PAD_PX}
        y={y}
        fontSize={LABEL_FONT_SIZE}
        fill={bandInk().text}
      >
        {text}
      </text>
    </g>
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
      {rows.map(row => {
        const badge = row.against ? `vs ${row.against}` : undefined
        const badgeX = HEADER_INSET_PX + 0.5
        const badgeWidth = badge
          ? measureText(badge, LABEL_FONT_SIZE) + 2 * BADGE_PAD_PX
          : 0
        const barX = badge
          ? badgeX + badgeWidth + HEADER_GAP_PX
          : HEADER_INSET_PX
        const labelX = row.color
          ? barX + LANE_COLOR_SWATCH_PX + HEADER_GAP_PX + INLINE_CHIP_PAD_PX
          : barX
        const scaleRight = width - HEADER_INSET_PX
        const changesRight = row.scale
          ? scaleRight - measureText(row.scale, LABEL_FONT_SIZE) - HEADER_GAP_PX
          : scaleRight
        const changesWidth = row.changes
          ? changesChipWidth(row.changes.text)
          : 0
        const labelRight = row.changes
          ? changesRight - changesWidth - HEADER_GAP_PX
          : changesRight
        const label = truncateToWidth(
          headerText(row),
          labelRight -
            labelX -
            (row.color || row.inline ? INLINE_CHIP_PAD_PX : 0),
          LABEL_FONT_SIZE,
        )
        return (
          <g key={`header-${row.assemblyName}`}>
            {badge ? (
              <>
                <rect
                  x={badgeX}
                  y={labelBoxTop(row.y) - 0.5}
                  width={badgeWidth}
                  height={LABEL_FONT_SIZE + 1}
                  rx={2}
                  fill={bandGroundColor()}
                  stroke={bandInk().text}
                />
                <text
                  x={badgeX + BADGE_PAD_PX}
                  y={row.y}
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight={600}
                  fill={bandInk().text}
                >
                  {badge}
                </text>
              </>
            ) : null}
            {row.color ? (
              <rect
                data-testid="multiway-lane-color"
                x={barX}
                y={labelBoxTop(row.y)}
                width={LANE_COLOR_SWATCH_PX}
                height={LABEL_FONT_SIZE}
                fill={row.color}
              />
            ) : null}
            {row.color ? (
              <SvgColorChip
                text={label}
                x={labelX}
                y={row.y}
                color={row.color}
              />
            ) : row.inline ? (
              <SvgInlineChip text={label} x={labelX} y={row.y} anchor="start" />
            ) : null}
            <SvgHaloText
              {...text}
              haloWidth={row.color ? 0 : text.haloWidth}
              x={labelX}
              y={row.y}
              fill={bandInk().text}
            >
              {label}
            </SvgHaloText>
            {row.changes ? (
              <SvgChangesChip
                text={row.changes.text}
                anchor={row.changes.anchor}
                right={changesRight}
                width={changesWidth}
                y={row.y}
              />
            ) : null}
            {row.scale ? (
              <>
                {row.inline ? (
                  <SvgInlineChip
                    text={row.scale}
                    x={scaleRight}
                    y={row.y}
                    anchor="end"
                  />
                ) : null}
                <SvgHaloText
                  {...text}
                  x={scaleRight}
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
