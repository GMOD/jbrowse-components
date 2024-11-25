import React from 'react'
import {
  getFillProps,
  getStrokeProps,
  getTickDisplayStr,
} from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import { getBlockLabelKeysToHide } from './util'
import type { DotplotViewModel } from '../model'

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
export const HorizontalAxis = observer(function ({
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

export const HorizontalAxisRaw = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, borderX, borderY, hview, htextRotation, hticks } = model
  const { offsetPx, width, dynamicBlocks, bpPerPx } = hview
  const dblocks = dynamicBlocks.contentBlocks
  const hide = getBlockLabelKeysToHide(dblocks, viewWidth, offsetPx)
  const theme = useTheme()
  const hviewSnap = {
    ...getSnapshot(hview),
    width,
    staticBlocks: hview.staticBlocks,
  }

  const ticks = hticks
    .map(
      tick =>
        [
          tick,
          bpToPx({
            refName: tick.refName,
            coord: tick.base,
            self: hviewSnap,
          })?.offsetPx,
        ] as const,
    )
    .filter(f => f[1] !== undefined)
    .map(f => [f[0], f[1]! - offsetPx] as const)

  return (
    <>
      {dblocks
        .filter(region => !hide.has(region.key))
        .map(region => {
          const x = region.offsetPx
          const y = 0
          const xoff = Math.floor(x - hview.offsetPx)

          return (
            <text
              transform={`rotate(${htextRotation},${xoff},${y})`}
              key={JSON.stringify(region)}
              x={xoff}
              y={y + 1}
              fontSize={11}
              dominantBaseline="hanging"
              textAnchor="end"
              {...getFillProps(theme.palette.text.primary)}
            >
              {region.refName}
            </text>
          )
        })}
      {ticks.map(([tick, x]) =>
        x > 0 && x < width ? (
          <line
            key={`line-${JSON.stringify(tick)}`}
            x1={x}
            x2={x}
            y1={0}
            y2={tick.type === 'major' ? 6 : 4}
            strokeWidth={1}
            {...getFillProps(theme.palette.text.primary)}
          />
        ) : null,
      )}
      {ticks
        .filter(t => t[0].type === 'major')
        .map(([tick, x]) =>
          x > 10 && x < width ? (
            <text
              x={x - 7}
              y={0}
              transform={`rotate(${htextRotation},${x},0)`}
              key={`text-${JSON.stringify(tick)}`}
              fontSize={11}
              dominantBaseline="middle"
              textAnchor="end"
              {...getFillProps(theme.palette.text.primary)}
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
        {...getFillProps(theme.palette.text.primary)}
      >
        {hview.assemblyNames.join(',')}
      </text>
    </>
  )
})
export const VerticalAxis = observer(function ({
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

export const VerticalAxisRaw = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewHeight, borderX, borderY, vview, vtextRotation, vticks } = model
  const { offsetPx, width, dynamicBlocks, bpPerPx } = vview
  const dblocks = dynamicBlocks.contentBlocks
  const hide = getBlockLabelKeysToHide(dblocks, viewHeight, offsetPx)
  const theme = useTheme()
  const vviewSnap = {
    ...getSnapshot(vview),
    width,
    staticBlocks: vview.staticBlocks,
  }
  const ticks = vticks
    .map(
      tick =>
        [
          tick,
          bpToPx({
            refName: tick.refName,
            coord: tick.base,
            self: vviewSnap,
          })?.offsetPx,
        ] as const,
    )
    .filter(f => f[1] !== undefined)
    .map(f => [f[0], f[1]! - offsetPx] as const)

  return (
    <>
      {dblocks
        .filter(region => !hide.has(region.key))
        .map(region => {
          const y = region.offsetPx
          const x = borderX
          const yoff = Math.floor(viewHeight - y + offsetPx)

          return (
            <text
              transform={`rotate(${vtextRotation},${x},${y})`}
              key={JSON.stringify(region)}
              x={x}
              y={yoff}
              fontSize={11}
              textAnchor="end"
              {...getFillProps(theme.palette.text.primary)}
            >
              {region.refName}
            </text>
          )
        })}
      {ticks.map(([tick, y]) =>
        y > 0 ? (
          <line
            key={`line-${JSON.stringify(tick)}`}
            y1={viewHeight - y}
            y2={viewHeight - y}
            x1={borderX}
            x2={borderX - (tick.type === 'major' ? 6 : 4)}
            strokeWidth={1}
            {...getStrokeProps(theme.palette.grey[400])}
          />
        ) : null,
      )}
      {ticks
        .filter(t => t[0].type === 'major')
        .map(([tick, y]) =>
          y > 10 && y < viewHeight ? (
            <text
              y={viewHeight - y - 3}
              x={borderX - 7}
              key={`text-${JSON.stringify(tick)}`}
              textAnchor="end"
              dominantBaseline="hanging"
              fontSize={11}
              {...getFillProps(theme.palette.text.primary)}
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
        {...getFillProps(theme.palette.text.primary)}
      >
        {vview.assemblyNames.join(',')}
      </text>
    </>
  )
})
