import {
  getFillProps,
  getStrokeProps,
  getTickDisplayStr,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { PositionedTick } from './util.ts'
import type { DotplotViewModel } from '../model.ts'

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
function tickLen(t: PositionedTick) {
  return t.tick.type === 'major' ? 6 : 4
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
  const { viewWidth, borderX, borderY, hview, htextRotation } = model
  const { offsetPx, width, dynamicBlocks, bpPerPx } = hview
  const blocks = dynamicBlocks.contentBlocks
  const hide = model.hblockLabelKeysToHide
  const ticks = model.hTickPositions
  const theme = useTheme()
  const fill = getFillProps(theme.palette.text.primary)
  const stroke = getStrokeProps(theme.palette.text.primary)

  return (
    <>
      {blocks
        .filter(b => !hide.has(b.key))
        .map(b => {
          const xoff = Math.floor(b.offsetPx - offsetPx)
          return (
            <text
              transform={`rotate(${htextRotation},${xoff},0)`}
              key={b.key}
              x={xoff}
              y={1}
              fontSize={11}
              dominantBaseline="hanging"
              textAnchor="end"
              {...fill}
            >
              {b.refName}
            </text>
          )
        })}
      {ticks.map(({ tick, alongPx: x }, idx) =>
        x > 0 && x < width ? (
          <line
            // eslint-disable-next-line @eslint-react/no-array-index-key -- static axis tick marks, never reorder
            key={`line-${tick.refName}-${tick.base}-${idx}`}
            x1={x}
            x2={x}
            y1={0}
            y2={tickLen({ tick, alongPx: x })}
            strokeWidth={1}
            {...stroke}
          />
        ) : null,
      )}
      {ticks.map(({ tick, alongPx: x }, idx) =>
        tick.type === 'major' && x > 10 && x < width ? (
          <text
            x={x - 7}
            y={0}
            transform={`rotate(${htextRotation},${x},0)`}
            // eslint-disable-next-line @eslint-react/no-array-index-key -- static axis tick marks, never reorder
            key={`text-${tick.refName}-${tick.base}-${idx}`}
            fontSize={11}
            dominantBaseline="middle"
            textAnchor="end"
            {...fill}
          >
            {getTickDisplayStr(tick.base + 1, bpPerPx)}
          </text>
        ) : null,
      )}
      <text
        y={borderY - 12}
        x={(viewWidth - borderX) / 2}
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
  const { viewHeight, borderX, borderY, vview, vtextRotation } = model
  const { offsetPx, dynamicBlocks, bpPerPx } = vview
  const blocks = dynamicBlocks.contentBlocks
  const hide = model.vblockLabelKeysToHide
  const ticks = model.vTickPositions
  const theme = useTheme()
  const fill = getFillProps(theme.palette.text.primary)
  const stroke = getStrokeProps(theme.palette.text.primary)

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
              transform={`rotate(${vtextRotation},${borderX},${b.offsetPx})`}
              key={b.key}
              x={borderX}
              y={yoff}
              fontSize={11}
              textAnchor="end"
              {...fill}
            >
              {b.refName}
            </text>
          )
        })}
      {ticks.map(({ tick, alongPx }, idx) => {
        const y = viewHeight - alongPx
        const len = tickLen({ tick, alongPx })
        return alongPx > 0 && alongPx < viewHeight ? (
          <line
            // eslint-disable-next-line @eslint-react/no-array-index-key -- static axis tick marks, never reorder
            key={`line-${tick.refName}-${tick.base}-${idx}`}
            y1={y}
            y2={y}
            x1={borderX}
            x2={borderX - len}
            strokeWidth={1}
            {...stroke}
          />
        ) : null
      })}
      {ticks.map(({ tick, alongPx }, idx) =>
        tick.type === 'major' && alongPx > 10 && alongPx < viewHeight ? (
          <text
            y={viewHeight - alongPx - 3}
            x={borderX - 7}
            // eslint-disable-next-line @eslint-react/no-array-index-key -- static axis tick marks, never reorder
            key={`text-${tick.refName}-${tick.base}-${idx}`}
            textAnchor="end"
            dominantBaseline="hanging"
            fontSize={11}
            {...fill}
          >
            {getTickDisplayStr(tick.base + 1, bpPerPx)}
          </text>
        ) : null,
      )}
      <text
        y={(viewHeight - borderY) / 2}
        x={12}
        transform={`rotate(-90,12,${(viewHeight - borderY) / 2})`}
        textAnchor="middle"
        fontSize={11}
        {...fill}
      >
        {vview.assemblyNames.join(',')}
      </text>
    </>
  )
})
