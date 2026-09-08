import { useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { pointToSegmentDist, svgMousePoint } from '../util.ts'
import { BandSeamHandle } from './BandSeamHandle.tsx'
import {
  connectorFieldAlpha,
  drawConnectorField,
} from './drawConnectorField.ts'

/* eslint-disable react-refresh/only-export-components */
import type { Ctx2D, PaintLayerOpts } from '@jbrowse/core/util/paintLayer'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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

// Everything the overlay needs off a display, so the SVG-export paths can
// declare it too rather than restating the fields.
export interface ConnectorLinesModel extends IStateTreeNode {
  height: number
  lineZoneHeight: number
  connectorLineCoords: ConnectorCoord[]
  setLineZoneHeight: (arg: number) => void
}

// The red connector line drawn for the hovered (or crosshair) column. Stays in
// the SVG above the field: it is one line, it has to sit on top, and the export
// wants it as vector whatever the field rasterized to.
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

/**
 * The faint field of every connector line, on a canvas rather than in the SVG
 * above it: 10^4 lines want 10^4 separate composites (see `drawConnectorField`)
 * and 10^4 SVG elements is not a thing to mount.
 *
 * Its own observer, so a mousemove over the zone — which is React state on the
 * overlay, and fires per pixel — re-renders the hover chrome without repainting
 * the field under it.
 */
const ConnectorLineField = observer(function ConnectorLineField({
  lineCoords,
  lineZoneHeight,
  width,
  strokeWidth,
  exportSVG,
  opts,
}: {
  lineCoords: ConnectorCoord[]
  lineZoneHeight: number
  width: number
  strokeWidth: number
  exportSVG?: boolean
  opts?: PaintLayerOpts
}) {
  const theme = useTheme()
  const color = alpha(
    theme.palette.text.primary,
    connectorFieldAlpha(lineCoords, strokeWidth),
  )
  const paint = (ctx: Ctx2D) => {
    drawConnectorField(ctx, lineCoords, lineZoneHeight, strokeWidth, color)
  }

  return lineZoneHeight <= 0 ? null : exportSVG ? (
    <PaintLayer
      width={width}
      height={lineZoneHeight}
      opts={opts}
      paint={paint}
    />
  ) : (
    <OverlayCanvas width={width} height={lineZoneHeight} draw={paint} />
  )
})

// The zone's hover hit-test. A transparent rect rather than the lines
// themselves: they are on a canvas now, and were `pointerEvents: none` before
// that — a 0.5px line is not something a pointer can be asked to hit.
function ConnectorHitTestRect({
  lineCoords,
  lineZoneHeight,
  onHover,
}: {
  lineCoords: ConnectorCoord[]
  lineZoneHeight: number
  onHover: (coord: ConnectorCoord | undefined) => void
}) {
  return (
    <rect
      x={0}
      y={0}
      width="100%"
      height={lineZoneHeight}
      fill="transparent"
      onMouseMove={event => {
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
      }}
      onMouseLeave={() => {
        onHover(undefined)
      }}
    />
  )
}

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
 * The drag handle along the bottom of the zone, sitting `top` pixels down. Every
 * zone in both displays resizes through this one `lineZoneHeight` slot (the
 * clamp lives in the setter), so a zone dragged shut can always be dragged back
 * open.
 */
export const ConnectorZoneResizeHandle = observer(
  function ConnectorZoneResizeHandle({
    model,
    top,
  }: {
    model: ConnectorLinesModel
    top: number
  }) {
    return (
      <BandSeamHandle
        top={top}
        // from where the handle is drawn, not from the slot: in LD's genomic
        // mode the zone is only as tall as what is switched on, and dragging
        // the slot up from under it would eat the first N pixels doing nothing
        onDrag={d => {
          model.setLineZoneHeight(top + d)
        }}
      />
    )
  },
)

/**
 * The lines tying each matrix column to its genomic position, shared by the LD
 * and multi-sample-matrix displays: the faint field, the hovered line and its
 * tooltip, an optional externally driven `highlight` (the matrix crosshair
 * column), and the drag handle that resizes the zone.
 */
export const ConnectorLineOverlay = observer(function ConnectorLineOverlay({
  model,
  strokeWidth,
  highlight,
  exportSVG,
  opts,
  children,
}: {
  model: ConnectorLinesModel
  strokeWidth: number
  highlight?: ConnectorCoord
  exportSVG?: boolean
  opts?: PaintLayerOpts
  children?: React.ReactNode
}) {
  const { height, lineZoneHeight, connectorLineCoords: lineCoords } = model
  const { width } = containingLgv(model)
  const [hovered, setHovered] = useState<ConnectorCoord>()
  // The coords are rebuilt whenever the view moves, so a hovered entry missing
  // from the current list is one left over from a zoom or a refetch that never
  // got a mousemove to clear it — drawing it would put the red line and its
  // tooltip on the position the column used to have.
  const current = hovered && lineCoords.includes(hovered) ? hovered : undefined
  // a real hover wins over the crosshair column it necessarily sits on
  const emphasized = current ? current : highlight

  return (
    <>
      {lineCoords.length === 0 ? null : (
        <>
          <ConnectorLineField
            lineCoords={lineCoords}
            lineZoneHeight={lineZoneHeight}
            width={width}
            strokeWidth={strokeWidth}
            exportSVG={exportSVG}
            opts={opts}
          />
          {/* the chrome the field cannot carry, in the SVG over it: the
              hit-test, the labels, the emphasized line */}
          <ConnectorZone exportSVG={exportSVG} width={width} height={height}>
            {exportSVG ? null : (
              <ConnectorHitTestRect
                lineCoords={lineCoords}
                lineZoneHeight={lineZoneHeight}
                onHover={coord => {
                  setHovered(coord)
                }}
              />
            )}
            {children}
            {emphasized ? (
              <ConnectorLine
                mx={emphasized.mx}
                gx={emphasized.gx}
                lineZoneHeight={lineZoneHeight}
              />
            ) : null}
          </ConnectorZone>
          {current?.label ? <BaseTooltip>{current.label}</BaseTooltip> : null}
        </>
      )}
      {/* Not gated on there being lines: the zone still takes up
      `lineZoneHeight`, and a viewport with no variants in it is exactly when a
      user wants to drag that space back. */}
      {exportSVG || lineZoneHeight === 0 ? null : (
        <ConnectorZoneResizeHandle model={model} top={lineZoneHeight} />
      )}
    </>
  )
})
