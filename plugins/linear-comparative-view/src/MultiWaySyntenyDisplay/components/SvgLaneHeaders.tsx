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
  changesTitle,
  headerText,
  labelBoxTop,
} from '../laneHeader.ts'
import { GENE_LABEL_HALO_PX } from '../laneLabels.ts'

import type { LaneHeaderRow } from '../laneHeader.ts'

// Noto Sans sets text up to a tenth wider than measureText's Helvetica table,
// and semibold wider again: boxes and gaps are sized for that, text centred.
const EXPORT_WIDTH_SLACK = 1.1
const SEMIBOLD_WIDTH = 1.05

function exportTextWidth(text: string, fontFamily?: string) {
  return measureText(text, LABEL_FONT_SIZE, fontFamily) * EXPORT_WIDTH_SLACK
}

function chipWidth(text: string, fontFamily?: string) {
  return exportTextWidth(text, fontFamily) + 2 * INLINE_CHIP_PAD_PX
}

function SvgInlineChip({
  width,
  y,
  x,
  anchor,
}: {
  width: number
  y: number
  x: number
  anchor: 'start' | 'end'
}) {
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
  width,
  y,
  x,
  color,
}: {
  width: number
  y: number
  x: number
  color: string
}) {
  const box = {
    x: x - INLINE_CHIP_PAD_PX,
    y: labelBoxTop(y),
    width,
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

function SvgHeaderChip({
  text,
  title,
  right,
  width,
  y,
  testId,
}: {
  text: string
  title: string
  right: number
  width: number
  y: number
  testId: string
}) {
  return (
    <g data-testid={testId}>
      <title>{title}</title>
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
        x={right - width / 2}
        y={y}
        fontSize={LABEL_FONT_SIZE}
        textAnchor="middle"
        fill={bandInk().text}
      >
        {text}
      </text>
    </g>
  )
}

/**
 * The lanes' headers in an export, sized and cut in `fontFamily`, the one the
 * export's text draws in.
 */
export function SvgLaneHeaders({
  rows,
  width,
  fontFamily,
}: {
  rows: LaneHeaderRow[]
  width: number
  fontFamily?: string
}) {
  const textWidth = (text: string) => exportTextWidth(text, fontFamily)
  const boxWidth = (text: string) => chipWidth(text, fontFamily)
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
          ? textWidth(badge) * SEMIBOLD_WIDTH + 2 * BADGE_PAD_PX
          : 0
        const barX = badge
          ? badgeX + badgeWidth + HEADER_GAP_PX
          : HEADER_INSET_PX
        const labelX = row.color
          ? barX + LANE_COLOR_SWATCH_PX + HEADER_GAP_PX + INLINE_CHIP_PAD_PX
          : barX
        const scaleRight = width - HEADER_INSET_PX
        const repeatsRight = row.scale
          ? scaleRight - textWidth(row.scale) - HEADER_GAP_PX
          : scaleRight
        const repeatsWidth = row.repeats ? boxWidth(row.repeats.text) : 0
        const changesRight = row.repeats
          ? repeatsRight - repeatsWidth - HEADER_GAP_PX
          : repeatsRight
        const changesWidth = row.changes ? boxWidth(row.changes.text) : 0
        const labelRight = row.changes
          ? changesRight - changesWidth - HEADER_GAP_PX
          : changesRight
        const label = truncateToWidth(
          headerText(row),
          (labelRight -
            labelX -
            (row.color || row.inline ? INLINE_CHIP_PAD_PX : 0)) /
            EXPORT_WIDTH_SLACK,
          LABEL_FONT_SIZE,
          fontFamily,
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
                  x={badgeX + badgeWidth / 2}
                  y={row.y}
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight={600}
                  textAnchor="middle"
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
                width={boxWidth(label)}
                x={labelX}
                y={row.y}
                color={row.color}
              />
            ) : row.inline ? (
              <SvgInlineChip
                width={boxWidth(label)}
                x={labelX}
                y={row.y}
                anchor="start"
              />
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
              <SvgHeaderChip
                text={row.changes.text}
                title={changesTitle(row.changes.anchor)}
                right={changesRight}
                width={changesWidth}
                y={row.y}
                testId="multiway-lane-changes"
              />
            ) : null}
            {row.repeats ? (
              <SvgHeaderChip
                text={row.repeats.text}
                title={row.repeats.title}
                right={repeatsRight}
                width={repeatsWidth}
                y={row.y}
                testId="multiway-lane-repeats"
              />
            ) : null}
            {row.scale ? (
              <>
                {row.inline ? (
                  <SvgInlineChip
                    width={boxWidth(row.scale)}
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
