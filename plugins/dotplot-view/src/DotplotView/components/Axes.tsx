import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { getTickDisplayStr } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { useTheme } from '@mui/material'

// locals
import { getBlockLabelKeysToHide } from './util'
import { DotplotViewModel } from '../model'

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
              fill={theme.palette.text.primary}
              fontSize={11}
              dominantBaseline="hanging"
              textAnchor="end"
            >
              {region.refName}
            </text>
          )
        })}
      {hticks.map(tick => {
        const x =
          (bpToPx({
            refName: tick.refName,
            coord: tick.base,
            self: hviewSnap,
          })?.offsetPx || 0) - offsetPx
        return (
          <line
            key={`line-${JSON.stringify(tick)}`}
            x1={x}
            x2={x}
            y1={0}
            y2={tick.type === 'major' ? 6 : 4}
            strokeWidth={1}
            stroke={theme.palette.divider}
          />
        )
      })}
      {hticks
        .filter(tick => tick.type === 'major')
        .map(tick => {
          const x =
            (bpToPx({
              refName: tick.refName,
              coord: tick.base,
              self: hviewSnap,
            })?.offsetPx || 0) - offsetPx
          const y = 0
          return x > 10 ? (
            <text
              x={x - 7}
              y={y}
              transform={`rotate(${htextRotation},${x},${y})`}
              key={`text-${JSON.stringify(tick)}`}
              fill={theme.palette.text.primary}
              fontSize={11}
              dominantBaseline="middle"
              textAnchor="end"
            >
              {getTickDisplayStr(tick.base + 1, bpPerPx)}
            </text>
          ) : null
        })}
      <text
        y={borderY - 12}
        x={(viewWidth - borderX) / 2}
        fill={theme.palette.text.primary}
        textAnchor="middle"
        fontSize={11}
        dominantBaseline="hanging"
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
              fill={theme.palette.text.primary}
              fontSize={11}
              textAnchor="end"
            >
              {region.refName}
            </text>
          )
        })}
      {vticks.map(tick => {
        const y =
          (bpToPx({
            refName: tick.refName,
            coord: tick.base,
            self: vviewSnap,
          })?.offsetPx || 0) - offsetPx
        return (
          <line
            key={`line-${JSON.stringify(tick)}`}
            y1={viewHeight - y}
            y2={viewHeight - y}
            x1={borderX}
            x2={borderX - (tick.type === 'major' ? 6 : 4)}
            strokeWidth={1}
            stroke={theme.palette.divider}
          />
        )
      })}
      {vticks
        .filter(tick => tick.type === 'major')
        .map(tick => {
          const y =
            (bpToPx({
              refName: tick.refName,
              coord: tick.base,
              self: vviewSnap,
            })?.offsetPx || 0) - offsetPx
          return y > 10 ? (
            <text
              y={viewHeight - y - 3}
              x={borderX - 7}
              key={`text-${JSON.stringify(tick)}`}
              textAnchor="end"
              fill={theme.palette.text.primary}
              dominantBaseline="hanging"
              fontSize={11}
            >
              {getTickDisplayStr(tick.base + 1, bpPerPx)}
            </text>
          ) : null
        })}
      <text
        y={(viewHeight - borderY) / 2}
        x={12}
        fill={theme.palette.text.primary}
        transform={`rotate(-90,12,${(viewHeight - borderY) / 2})`}
        textAnchor="middle"
        fontSize={11}
      >
        {vview.assemblyNames.join(',')}
      </text>
    </>
  )
})
