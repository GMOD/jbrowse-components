import { Fragment } from 'react'

import { getBpDisplayStr, stripAlpha } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import {
  AXIS_LABEL_FONT,
  AXIS_TITLE_FONT,
  fitAxisTitle,
  tickKey,
  tickLabel,
} from './util.ts'

import type { DotplotViewModel } from '../model.ts'
import type { Tick } from './util.ts'

const useStyles = makeStyles()(() => ({
  vtext: {
    gridColumn: '1/2',
    gridRow: '1/2',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  htext: {
    gridColumn: '2/2',
    gridRow: '2/2',
    pointerEvents: 'none',
    userSelect: 'none',
  },
}))

// Tick lines are 4px (minor) or 6px (major) long in the cross-axis direction.
function tickLen(tick: Tick) {
  return tick.type === 'major' ? 6 : 4
}

// The assembly name centered along an axis. Elided to the axis' own length —
// centered text in an SVG sized to the plot is otherwise clipped at both ends,
// and the read-vs-ref dotplot's synthetic assembly name (a read name plus an
// `_assembly_<timestamp>` uniquifier) routinely runs past it. Full name on hover.
function AxisTitle({
  title,
  availablePx,
  x,
  y,
  transform,
  dominantBaseline,
  fill,
}: {
  title: string
  availablePx: number
  x: number
  y: number
  transform?: string
  dominantBaseline?: 'hanging'
  fill: string
}) {
  const text = fitAxisTitle(title, availablePx)
  return (
    <text
      x={x}
      y={y}
      transform={transform}
      textAnchor="middle"
      fontSize={AXIS_TITLE_FONT}
      dominantBaseline={dominantBaseline}
      fill={fill}
    >
      {text === title ? null : <title>{title}</title>}
      {text}
    </text>
  )
}

// One hue for axis text (fill) and tick lines (stroke), shared by the horizontal
// and vertical axes: the primary text color, as an opaque hex.
function useAxisColor() {
  return stripAlpha(useTheme().palette.text.primary)
}

export const HorizontalAxis = observer(function HorizontalAxis({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, borderY } = model
  const { classes } = useStyles()
  return (
    <svg width={viewWidth} height={borderY} className={classes.htext}>
      <HorizontalAxisRaw model={model} />
    </svg>
  )
})

export const HorizontalAxisRaw = observer(function HorizontalAxisRaw({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, borderY, hview, visibleHTickPositions: ticks } = model
  // Horizontal-axis labels are drawn vertically (rotated -90° about their anchor).
  const rotate = -90
  const { offsetPx, dynamicBlocks, bpPerPx } = hview
  const blocks = dynamicBlocks.contentBlocks
  const hide = model.hblockLabelKeysToHide
  const labels = model.hRefNameLabels
  const color = useAxisColor()

  return (
    <>
      {blocks
        .filter(b => !hide.has(b.key))
        .map(b => {
          const xoff = Math.floor(b.offsetPx - offsetPx)
          return (
            <text
              transform={`rotate(${rotate},${xoff},0)`}
              key={b.key}
              x={xoff}
              y={1}
              fontSize={AXIS_LABEL_FONT}
              dominantBaseline="hanging"
              textAnchor="end"
              fill={color}
            >
              <title>{b.refName}</title>
              {labels.get(b.refName) ?? b.refName}
            </text>
          )
        })}
      {ticks.map(({ tick, alongPx: x, labeled }) => (
        <Fragment key={tickKey(tick)}>
          <line
            x1={x}
            x2={x}
            y1={0}
            y2={tickLen(tick)}
            strokeWidth={1}
            stroke={color}
          />
          {/* `labeled` is the model's collision decision (major, and clear of
              the last label); `x > 10` is this axis' own edge rule, keeping a
              label off the region name drawn at the start of the axis. */}
          {labeled && x > 10 ? (
            <text
              x={x - 7}
              y={0}
              transform={`rotate(${rotate},${x},0)`}
              fontSize={AXIS_LABEL_FONT}
              dominantBaseline="middle"
              textAnchor="end"
              fill={color}
            >
              {tickLabel(tick, bpPerPx)}
            </text>
          ) : null}
        </Fragment>
      ))}
      <AxisTitle
        title={`${hview.assemblyNames.join(',')} (${getBpDisplayStr(hview.currBp)})`}
        availablePx={viewWidth}
        y={borderY - 12}
        x={viewWidth / 2}
        dominantBaseline="hanging"
        fill={color}
      />
    </>
  )
})

export const VerticalAxis = observer(function VerticalAxis({
  model,
}: {
  model: DotplotViewModel
}) {
  const { borderX, viewHeight } = model
  const { classes } = useStyles()
  return (
    <svg className={classes.vtext} width={borderX} height={viewHeight}>
      <VerticalAxisRaw model={model} />
    </svg>
  )
})

export const VerticalAxisRaw = observer(function VerticalAxisRaw({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewHeight, borderX, vview, visibleVTickPositions: ticks } = model
  const { offsetPx, dynamicBlocks, bpPerPx } = vview
  const blocks = dynamicBlocks.contentBlocks
  const hide = model.vblockLabelKeysToHide
  const labels = model.vRefNameLabels
  const color = useAxisColor()

  // Vertical axis is flipped: block offsetPx grows upward visually, so we map
  // alongPx (downward-natural) to viewHeight - alongPx.
  return (
    <>
      {blocks
        .filter(b => !hide.has(b.key))
        .map(b => {
          const yoff = Math.floor(viewHeight - b.offsetPx + offsetPx)
          return (
            <text
              key={b.key}
              x={borderX}
              y={yoff}
              fontSize={AXIS_LABEL_FONT}
              textAnchor="end"
              fill={color}
            >
              <title>{b.refName}</title>
              {labels.get(b.refName) ?? b.refName}
            </text>
          )
        })}
      {ticks.map(({ tick, alongPx, labeled }) => {
        const y = viewHeight - alongPx
        return (
          <Fragment key={tickKey(tick)}>
            <line
              y1={y}
              y2={y}
              x1={borderX}
              x2={borderX - tickLen(tick)}
              strokeWidth={1}
              stroke={color}
            />
            {labeled && alongPx > 10 ? (
              <text
                y={y - 3}
                x={borderX - 7}
                textAnchor="end"
                dominantBaseline="hanging"
                fontSize={AXIS_LABEL_FONT}
                fill={color}
              >
                {tickLabel(tick, bpPerPx)}
              </text>
            ) : null}
          </Fragment>
        )
      })}
      <AxisTitle
        title={`${vview.assemblyNames.join(',')} (${getBpDisplayStr(vview.currBp)})`}
        availablePx={viewHeight}
        y={viewHeight / 2}
        x={12}
        transform={`rotate(-90,12,${viewHeight / 2})`}
        fill={color}
      />
    </>
  )
})
