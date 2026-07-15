/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { getStrokeProps } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { pointToSegmentDist, svgMousePoint } from '../util.ts'

// One connector: `mx` is the matrix-column center x, `gx` the genomic x on the
// ruler. How those are computed differs per display (index layout vs the
// GPU-transformed LD triangle), so callers build the coords; everything below
// is shared so the two displays' hit-test/render can't drift apart.
export interface ConnectorCoord {
  mx: number
  gx: number
}

const useStyles = makeStyles()({
  resizeHandle: {
    height: 5,
    boxSizing: 'border-box',
  },
})

// The red connector line drawn for the hovered (or crosshair) column.
export function ConnectorLine({
  mx,
  gx,
  lineZoneHeight,
}: ConnectorCoord & { lineZoneHeight: number }) {
  return (
    <line
      stroke="#f00c"
      strokeWidth={2}
      style={{ pointerEvents: 'none' }}
      x1={mx}
      x2={gx}
      y1={lineZoneHeight}
      y2={0}
    />
  )
}

// The faint field of every connector line plus its hover hit-test. Reports the
// hovered index back so callers can drive their own highlight line/tooltip from
// their richer per-column data; `children` slots in extra overlay (e.g. SNP
// labels) beneath the lines.
export const ConnectorLineField = observer(function ConnectorLineField({
  lineCoords,
  lineZoneHeight,
  strokeWidth,
  onHoverIndex,
  children,
}: {
  lineCoords: ConnectorCoord[]
  lineZoneHeight: number
  strokeWidth: number
  onHoverIndex: (index: number | undefined) => void
  children?: React.ReactNode
}) {
  const theme = useTheme()
  const pathD = useMemo(
    () =>
      lineCoords
        .map(({ mx, gx }) => `M${mx} ${lineZoneHeight}L${gx} 0`)
        .join(''),
    [lineCoords, lineZoneHeight],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      const pt = svgMousePoint(event)
      if (!pt) {
        onHoverIndex(undefined)
      } else {
        let minDist = 10
        let found: number | undefined
        for (let i = 0; i < lineCoords.length; i++) {
          const coord = lineCoords[i]!
          const dist = pointToSegmentDist(
            pt.x,
            pt.y,
            coord.mx,
            lineZoneHeight,
            coord.gx,
            0,
          )
          if (dist < minDist) {
            minDist = dist
            found = i
          }
        }
        onHoverIndex(found)
      }
    },
    [lineCoords, lineZoneHeight, onHoverIndex],
  )

  return (
    <>
      <rect
        x={0}
        y={0}
        width="100%"
        height={lineZoneHeight}
        fill="transparent"
        onMouseMove={onMouseMove}
        onMouseLeave={() => {
          onHoverIndex(undefined)
        }}
      />
      <path
        d={pathD}
        {...getStrokeProps(alpha(theme.palette.text.primary, 0.4))}
        strokeWidth={strokeWidth}
        fill="none"
        style={{ pointerEvents: 'none' }}
      />
      {children}
    </>
  )
})

// The drag handle that resizes the connector zone.
export function ConnectorResizeHandle({
  lineZoneHeight,
  onResize,
}: {
  lineZoneHeight: number
  onResize: (delta: number) => void
}) {
  const { classes } = useStyles()
  return (
    <ResizeHandle
      style={{ position: 'absolute', top: lineZoneHeight - 4 }}
      onDrag={d => {
        onResize(d)
        return undefined
      }}
      className={classes.resizeHandle}
    />
  )
}
