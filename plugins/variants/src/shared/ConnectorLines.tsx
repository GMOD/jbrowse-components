/* eslint-disable react-refresh/only-export-components */
import { useCallback, useMemo, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getStrokeProps } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { pointToSegmentDist, svgMousePoint } from '../util.ts'
import { connectorLineAlpha } from './connectorLineAlpha.ts'

// One connector, in viewport pixels (0 = the view's left edge): `mx` is the
// matrix-column center at the bottom of the zone, `gx` the genomic position on
// the ruler at the top, `label` the tooltip shown on hover (SNP id / feature
// name; a variant with neither gets none). Each display derives these on its
// model — the column axis differs (feature index vs the GPU-transformed LD
// triangle) — but both land in this one frame, so everything below, and the
// SVG export, is shared and can't drift apart.
export interface ConnectorCoord {
  mx: number
  gx: number
  label?: string
}

const useStyles = makeStyles()({
  resizeHandle: {
    height: 5,
    boxSizing: 'border-box',
  },
})

// The red connector line drawn for the hovered (or crosshair) column.
function ConnectorLine({
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
// hovered coord back so the overlay can draw its highlight and tooltip;
// `children` slots in extra overlay (e.g. SNP labels) beneath the lines.
const ConnectorLineField = observer(function ConnectorLineField({
  lineCoords,
  lineZoneHeight,
  strokeWidth,
  onHover,
  children,
}: {
  lineCoords: ConnectorCoord[]
  lineZoneHeight: number
  strokeWidth: number
  onHover: (coord: ConnectorCoord | undefined) => void
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

  // Every line lands in one <path>, so the stroke alpha is shared: derive it
  // from how deep the lines stack across their own horizontal extent, else a
  // high-column-count matrix paints the zone solid (see connectorLineAlpha).
  const strokeAlpha = useMemo(() => {
    // indexed min/max rather than Math.max(...xs): lineCoords runs to ~10^4
    // entries on a pangenome VCF, past what a spread can safely pass as args
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const { mx, gx } of lineCoords) {
      lo = Math.min(lo, mx, gx)
      hi = Math.max(hi, mx, gx)
    }
    return connectorLineAlpha(lineCoords.length, hi - lo, strokeWidth)
  }, [lineCoords, strokeWidth])

  const onMouseMove = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      const pt = svgMousePoint(event)
      if (!pt) {
        onHover(undefined)
      } else {
        let minDist = 10
        let found: ConnectorCoord | undefined
        for (const coord of lineCoords) {
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
            found = coord
          }
        }
        onHover(found)
      }
    },
    [lineCoords, lineZoneHeight, onHover],
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
          onHover(undefined)
        }}
      />
      <path
        d={pathD}
        {...getStrokeProps(alpha(theme.palette.text.primary, strokeAlpha))}
        strokeWidth={strokeWidth}
        fill="none"
        style={{ pointerEvents: 'none' }}
      />
      {children}
    </>
  )
})

// The frame the zone's contents draw in: an absolutely positioned <svg> live,
// nothing at all in an SVG export (the export's own <svg> is already the frame).
// Neither shifts horizontally — the coords are viewport-relative to start with,
// so the |offsetPx| gap when the content doesn't reach the left viewport edge is
// carried by the coords, not by a transform the export would have to restate.
export function ConnectorZone({
  exportSVG,
  width,
  height,
  children,
}: {
  exportSVG?: boolean
  width: number
  height: number
  children: React.ReactNode
}) {
  return exportSVG ? (
    children
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height,
        width,
      }}
    >
      {children}
    </svg>
  )
}

/**
 * The lines tying each matrix column to its genomic position, shared by the LD
 * and multi-sample-matrix displays: the faint field, the hovered line and its
 * tooltip, an optional externally driven `highlight` (the matrix crosshair
 * column), and the drag handle that resizes the zone.
 */
export const ConnectorLineOverlay = observer(function ConnectorLineOverlay({
  lineCoords,
  lineZoneHeight,
  height,
  width,
  strokeWidth,
  highlight,
  exportSVG,
  onResize,
  children,
}: {
  lineCoords: ConnectorCoord[]
  lineZoneHeight: number
  height: number
  width: number
  strokeWidth: number
  highlight?: ConnectorCoord
  exportSVG?: boolean
  onResize: (delta: number) => void
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const [hovered, setHovered] = useState<ConnectorCoord>()
  // a real hover wins over the crosshair column it necessarily sits on
  const emphasized = hovered ? hovered : highlight

  return lineCoords.length === 0 ? null : (
    <>
      <ConnectorZone exportSVG={exportSVG} width={width} height={height}>
        <ConnectorLineField
          lineCoords={lineCoords}
          lineZoneHeight={lineZoneHeight}
          strokeWidth={strokeWidth}
          onHover={coord => {
            setHovered(coord)
          }}
        >
          {children}
        </ConnectorLineField>
        {emphasized ? (
          <ConnectorLine
            mx={emphasized.mx}
            gx={emphasized.gx}
            lineZoneHeight={lineZoneHeight}
          />
        ) : null}
        {hovered?.label ? <BaseTooltip>{hovered.label}</BaseTooltip> : null}
      </ConnectorZone>
      {exportSVG ? null : (
        <ResizeHandle
          style={{ position: 'absolute', top: lineZoneHeight - 4 }}
          onDrag={d => {
            onResize(d)
            return undefined
          }}
          className={classes.resizeHandle}
        />
      )}
    </>
  )
})
