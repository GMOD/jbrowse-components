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
}))

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
              fill={theme.palette.text.primary}
              fontSize={11}
              textAnchor="end"
            >
              {region.refName}
            </text>
          )
        })}
      {ticks.map(([tick, y]) => (
        <line
          key={`line-${JSON.stringify(tick)}`}
          y1={viewHeight - y}
          y2={viewHeight - y}
          x1={borderX}
          x2={borderX - (tick.type === 'major' ? 6 : 4)}
          strokeWidth={1}
          stroke={theme.palette.grey[400]}
        />
      ))}
      {ticks
        .filter(t => t[0].type === 'major')
        .map(([tick, y]) => {
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
