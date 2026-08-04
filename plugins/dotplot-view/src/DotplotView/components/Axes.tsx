import { Fragment } from 'react'

import { stripAlpha } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { AXIS_LABEL_FONT, tickKey, tickLabel, truncateRefName } from './util.ts'

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

// hue for axis text (fill) and tick lines (stroke); both are the primary text
// color, shared by the horizontal and vertical axes.
function useAxisColors() {
  const theme = useTheme()
  const color = stripAlpha(theme.palette.text.primary)
  return {
    fill: { fill: color },
    stroke: { stroke: color },
  }
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
  const { viewWidth, borderY, hview } = model
  // Horizontal-axis labels are drawn vertically (rotated -90° about their anchor).
  const rotate = -90
  const { offsetPx, dynamicBlocks, bpPerPx } = hview
  const blocks = dynamicBlocks.contentBlocks
  const hide = model.hblockLabelKeysToHide
  // ticks come from staticBlocks, which extend a screen past the viewport;
  // dropping the off-axis ones here (rather than per-element inside the map)
  // keeps the SVG export from carrying an empty group per invisible tick
  const ticks = model.hTickPositions.filter(
    t => t.alongPx > 0 && t.alongPx < viewWidth,
  )
  const { fill, stroke } = useAxisColors()

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
              {...fill}
            >
              <title>{b.refName}</title>
              {truncateRefName(b.refName)}
            </text>
          )
        })}
      {ticks.map(({ tick, alongPx: x }) => (
        <Fragment key={tickKey(tick)}>
          <line
            x1={x}
            x2={x}
            y1={0}
            y2={tickLen(tick)}
            strokeWidth={1}
            {...stroke}
          />
          {tick.type === 'major' && x > 10 ? (
            <text
              x={x - 7}
              y={0}
              transform={`rotate(${rotate},${x},0)`}
              fontSize={AXIS_LABEL_FONT}
              dominantBaseline="middle"
              textAnchor="end"
              {...fill}
            >
              {tickLabel(tick, bpPerPx)}
            </text>
          ) : null}
        </Fragment>
      ))}
      <text
        y={borderY - 12}
        x={viewWidth / 2}
        textAnchor="middle"
        fontSize={11}
        dominantBaseline="hanging"
        {...fill}
      >
        {hview.assemblyNames.join(',')}
      </text>
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
  const { viewHeight, borderX, vview } = model
  const { offsetPx, dynamicBlocks, bpPerPx } = vview
  const blocks = dynamicBlocks.contentBlocks
  const hide = model.vblockLabelKeysToHide
  // see HorizontalAxisRaw
  const ticks = model.vTickPositions.filter(
    t => t.alongPx > 0 && t.alongPx < viewHeight,
  )
  const { fill, stroke } = useAxisColors()

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
              {...fill}
            >
              <title>{b.refName}</title>
              {truncateRefName(b.refName)}
            </text>
          )
        })}
      {ticks.map(({ tick, alongPx }) => {
        const y = viewHeight - alongPx
        return (
          <Fragment key={tickKey(tick)}>
            <line
              y1={y}
              y2={y}
              x1={borderX}
              x2={borderX - tickLen(tick)}
              strokeWidth={1}
              {...stroke}
            />
            {tick.type === 'major' && alongPx > 10 ? (
              <text
                y={y - 3}
                x={borderX - 7}
                textAnchor="end"
                dominantBaseline="hanging"
                fontSize={AXIS_LABEL_FONT}
                {...fill}
              >
                {tickLabel(tick, bpPerPx)}
              </text>
            ) : null}
          </Fragment>
        )
      })}
      <text
        y={viewHeight / 2}
        x={12}
        transform={`rotate(-90,12,${viewHeight / 2})`}
        textAnchor="middle"
        fontSize={11}
        {...fill}
      >
        {vview.assemblyNames.join(',')}
      </text>
    </>
  )
})
