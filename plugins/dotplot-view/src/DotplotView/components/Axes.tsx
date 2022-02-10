import React from 'react'
import { makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import { getBlockLabelKeysToHide, makeTicks } from './util'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles(() => ({
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
  majorTickLabel: {
    fontSize: '11px',
  },
  majorTick: {
    stroke: '#555',
  },
  minorTick: {
    stroke: '#999',
  },
}))

export const HorizontalAxis = observer(
  ({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const { viewWidth, borderY, hview, htextRotation } = model
    const hide = getBlockLabelKeysToHide(
      hview.dynamicBlocks.contentBlocks,
      viewWidth,
      hview.offsetPx,
    )
    const ticks =
      hview.staticBlocks.contentBlocks.length > 5
        ? []
        : makeTicks(hview.staticBlocks.contentBlocks, hview.bpPerPx)
    return (
      <svg width={viewWidth} height={borderY} className={classes.htext}>
        {hview.dynamicBlocks.contentBlocks
          .filter(region => !hide.includes(region.key))
          .map(region => {
            const x = region.offsetPx
            const y = 0
            const xoff = x - hview.offsetPx
            return (
              <text
                transform={`rotate(${htextRotation},${xoff},${y})`}
                key={JSON.stringify(region)}
                x={xoff}
                y={y + 1}
                fill="#000000"
                dominantBaseline="hanging"
                textAnchor="end"
              >
                {[
                  region.refName,
                  region.start !== 0 ? Math.floor(region.start) : '',
                ]
                  .filter(f => !!f)
                  .join(':')}
              </text>
            )
          })}
        {ticks.map(tick => {
          const x =
            (hview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
            hview.offsetPx
          return (
            <line
              key={`line-${JSON.stringify(tick)}`}
              x1={x}
              x2={x}
              y1={0}
              y2={tick.type === 'major' ? 6 : 4}
              strokeWidth={1}
              stroke={tick.type === 'major' ? '#555' : '#999'}
              className={
                tick.type === 'major' ? classes.majorTick : classes.minorTick
              }
              data-bp={tick.base}
            />
          )
        })}
        {ticks
          .filter(tick => tick.type === 'major')
          .map(tick => {
            const x =
              (hview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
              hview.offsetPx
            const y = 0
            return (
              <text
                x={x - 7}
                y={y}
                transform={`rotate(${htextRotation},${x},${y})`}
                key={`text-${JSON.stringify(tick)}`}
                style={{ fontSize: '11px' }}
                className={classes.majorTickLabel}
                dominantBaseline="middle"
                textAnchor="end"
              >
                {(tick.base + 1).toLocaleString('en-US')}
              </text>
            )
          })}
      </svg>
    )
  },
)
export const VerticalAxis = observer(
  ({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const { borderX, viewHeight, vview, vtextRotation } = model
    const hide = getBlockLabelKeysToHide(
      vview.dynamicBlocks.contentBlocks,
      viewHeight,
      vview.offsetPx,
    )
    const ticks =
      vview.staticBlocks.contentBlocks.length > 5
        ? []
        : makeTicks(vview.staticBlocks.contentBlocks, vview.bpPerPx)
    return (
      <svg className={classes.vtext} width={borderX} height={viewHeight}>
        {vview.dynamicBlocks.contentBlocks
          .filter(region => !hide.includes(region.key))
          .map(region => {
            const y = region.offsetPx
            const x = borderX
            return (
              <text
                transform={`rotate(${vtextRotation},${x},${y})`}
                key={JSON.stringify(region)}
                x={x}
                y={viewHeight - y + vview.offsetPx}
                fill="#000000"
                textAnchor="end"
              >
                {[
                  region.refName,
                  region.start !== 0 ? Math.floor(region.start) : '',
                ]
                  .filter(f => !!f)
                  .join(':')}
              </text>
            )
          })}
        {ticks.map(tick => {
          const y =
            (vview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
            vview.offsetPx
          return (
            <line
              key={`line-${JSON.stringify(tick)}`}
              y1={viewHeight - y}
              y2={viewHeight - y}
              x1={borderX}
              x2={borderX - (tick.type === 'major' ? 6 : 4)}
              strokeWidth={1}
              stroke={tick.type === 'major' ? '#555' : '#999'}
              className={
                tick.type === 'major' ? classes.majorTick : classes.minorTick
              }
              data-bp={tick.base}
            />
          )
        })}
        {ticks
          .filter(tick => tick.type === 'major')
          .map(tick => {
            const y =
              (vview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
              vview.offsetPx
            return (
              <text
                y={viewHeight - y - 3}
                x={borderX - 7}
                key={`text-${JSON.stringify(tick)}`}
                textAnchor="end"
                dominantBaseline="hanging"
                style={{ fontSize: '11px' }}
                className={classes.majorTickLabel}
              >
                {(tick.base + 1).toLocaleString('en-US')}
              </text>
            )
          })}
      </svg>
    )
  },
)
