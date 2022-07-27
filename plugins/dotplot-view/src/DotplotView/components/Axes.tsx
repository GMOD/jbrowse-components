import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { getBlockLabelKeysToHide } from './util'
import { getTickDisplayStr } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
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
    const { classes } = useStyles()
    const { viewWidth, borderX, borderY, hview, htextRotation, hticks } = model
    const { offsetPx, width, dynamicBlocks, bpPerPx } = hview
    const dblocks = dynamicBlocks.contentBlocks
    const hide = getBlockLabelKeysToHide(dblocks, viewWidth, offsetPx)
    const hviewSnap = {
      ...getSnapshot(hview),
      width,
      staticBlocks: hview.staticBlocks,
    }
    return (
      <svg width={viewWidth} height={borderY} className={classes.htext}>
        {dblocks
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
              stroke={tick.type === 'major' ? '#555' : '#999'}
              className={
                tick.type === 'major' ? classes.majorTick : classes.minorTick
              }
              data-bp={tick.base}
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
                {getTickDisplayStr(tick.base + 1, bpPerPx)}
              </text>
            )
          })}
        {hview.assemblyNames.length === 1 ? (
          <text
            y={borderY - 12}
            x={(viewWidth - borderX) / 2}
            fill="black"
            textAnchor="middle"
          >
            {hview.assemblyNames[0]}
          </text>
        ) : null}
      </svg>
    )
  },
)
export const VerticalAxis = observer(
  ({ model }: { model: DotplotViewModel }) => {
    const { classes } = useStyles()
    const { borderX, viewHeight, borderY, vview, vtextRotation, vticks } = model
    const { offsetPx, width, dynamicBlocks, bpPerPx } = vview
    const dblocks = dynamicBlocks.contentBlocks
    const hide = getBlockLabelKeysToHide(dblocks, viewHeight, offsetPx)
    const vviewSnap = {
      ...getSnapshot(vview),
      width,
      staticBlocks: vview.staticBlocks,
    }
    return (
      <svg className={classes.vtext} width={borderX} height={viewHeight}>
        {dblocks
          .filter(region => !hide.includes(region.key))
          .map(region => {
            const y = region.offsetPx
            const x = borderX
            return (
              <text
                transform={`rotate(${vtextRotation},${x},${y})`}
                key={JSON.stringify(region)}
                x={x}
                y={viewHeight - y + offsetPx}
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
              stroke={tick.type === 'major' ? '#555' : '#999'}
              className={
                tick.type === 'major' ? classes.majorTick : classes.minorTick
              }
              data-bp={tick.base}
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
                {getTickDisplayStr(tick.base + 1, bpPerPx)}
              </text>
            )
          })}
        {vview.assemblyNames.length === 1 ? (
          <text
            y={(viewHeight - borderY) / 2}
            x={12}
            transform={`rotate(-90,12,${(viewHeight - borderY) / 2})`}
            textAnchor="middle"
          >
            {vview.assemblyNames[0]}
          </text>
        ) : null}
      </svg>
    )
  },
)
