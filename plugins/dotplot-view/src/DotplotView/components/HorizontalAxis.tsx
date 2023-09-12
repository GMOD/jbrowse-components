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
              fill={theme.palette.text.primary}
              fontSize={11}
              dominantBaseline="hanging"
              textAnchor="end"
            >
              {region.refName}
            </text>
          )
        })}
      {ticks.map(([tick, x]) => {
        return (
          <line
            key={`line-${JSON.stringify(tick)}`}
            x1={x}
            x2={x}
            y1={0}
            y2={tick.type === 'major' ? 6 : 4}
            strokeWidth={1}
            stroke={theme.palette.grey[400]}
          />
        )
      })}
      {ticks
        .filter(t => t[0].type === 'major')
        .map(([tick, x]) => {
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
