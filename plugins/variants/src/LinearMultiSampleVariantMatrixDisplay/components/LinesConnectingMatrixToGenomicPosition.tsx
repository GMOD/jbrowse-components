import { useCallback, useMemo, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { mirrorColumnIndex } from './variantMatrixRenderingBackendTypes.ts'
import { pointToSegmentDist, svgMousePoint } from '../../util.ts'

import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  resizeHandle: {
    height: 5,
    boxSizing: 'border-box',
  },
})

interface MinimalModel {
  setLineZoneHeight: (arg: number) => number
  height: number
  lineZoneHeight: number
  featuresVolatile: Feature[] | undefined
  flipped: boolean
}

function getGenomicX(
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  feature: Feature,
  offsetAdj: number,
) {
  return (
    (view.bpToPx({
      refName: assembly.getCanonicalRefName2(feature.get('refName')),
      coord: feature.get('start'),
    })?.offsetPx ?? 0) - offsetAdj
  )
}

// Shared column/offset geometry for the connector lines. `w` is one matrix
// column's px width, `mx = idx*w + w/2` its center; genomic ends map through
// getGenomicX(offsetAdj). AllLines, HighlightedLine, and the hovered line all
// key off this so columns/lines/hit-tests stay pixel-aligned with the matrix
// canvas (which lays out by totalWidthPxWithoutBorders / numFeatures).
function getLineGeometry(model: MinimalModel) {
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { featuresVolatile } = model
  const assembly = assemblyManager.get(view.assemblyNames[0]!)
  const n = featuresVolatile?.length ?? 0
  const w = n === 0 ? 0 : view.totalWidthPxWithoutBorders / n
  return {
    view,
    assembly,
    featuresVolatile,
    n,
    w,
    flipped: model.flipped,
    offsetAdj: Math.max(view.offsetPx, 0),
    left: Math.max(0, -view.offsetPx),
  }
}

// The red matrix→genome connector line (hovered column + crosshair column).
function ConnectorLine({
  mx,
  gx,
  lineZoneHeight,
}: {
  mx: number
  gx: number
  lineZoneHeight: number
}) {
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

interface HoveredLine {
  feature: Feature
  mx: number
  genomicX: number
}

const Wrapper = observer(function Wrapper({
  children,
  model,
  exportSVG,
}: {
  model: MinimalModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const { height } = model
  const { width, offsetPx } = getContainingView(model) as LinearGenomeViewModel
  const left = Math.max(0, -offsetPx)
  return exportSVG ? (
    <g transform={`translate(${left})`}>{children}</g>
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left,
        height,
        width,
      }}
    >
      {children}
    </svg>
  )
})

const AllLines = observer(function AllLines({
  model,
  onHover,
}: {
  model: MinimalModel
  onHover: (arg: HoveredLine | undefined) => void
}) {
  const theme = useTheme()
  const { view, assembly, featuresVolatile, n, w, flipped, offsetAdj } =
    getLineGeometry(model)
  const { lineZoneHeight } = model

  const lineCoords = useMemo(() => {
    if (!assembly || !featuresVolatile || n === 0) {
      return []
    }
    return featuresVolatile.map((feature, i) => ({
      feature,
      mx: mirrorColumnIndex(i, n, flipped) * w + w / 2,
      gx: getGenomicX(view, assembly, feature, offsetAdj),
    }))
  }, [assembly, featuresVolatile, n, w, flipped, view, offsetAdj])

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
        onHover(undefined)
        return
      }
      let minDist = 10
      let found: (typeof lineCoords)[0] | undefined
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
      onHover(
        found
          ? { feature: found.feature, mx: found.mx, genomicX: found.gx }
          : undefined,
      )
    },
    [lineCoords, lineZoneHeight, onHover],
  )

  if (!assembly || n === 0) {
    return null
  }

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
        {...getStrokeProps(alpha(theme.palette.text.primary, 0.4))}
        strokeWidth={0.5}
        fill="none"
        style={{ pointerEvents: 'none' }}
      />
    </>
  )
})

const HighlightedLine = observer(function HighlightedLine({
  model,
  crosshairX,
}: {
  model: MinimalModel
  crosshairX: number
}) {
  const { view, assembly, featuresVolatile, n, w, flipped, offsetAdj, left } =
    getLineGeometry(model)
  const { lineZoneHeight } = model

  if (!assembly || !featuresVolatile || n === 0) {
    return null
  }

  // crosshairX picks a screen column; mirror it back to the data index so the
  // line anchors to the feature actually drawn under the crosshair.
  const screenCol = Math.floor((crosshairX - left) / w)
  if (screenCol < 0 || screenCol >= n) {
    return null
  }

  const dataIdx = mirrorColumnIndex(screenCol, n, flipped)
  const gx = getGenomicX(view, assembly, featuresVolatile[dataIdx]!, offsetAdj)
  return (
    <ConnectorLine
      mx={screenCol * w + w / 2}
      gx={gx}
      lineZoneHeight={lineZoneHeight}
    />
  )
})

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
    crosshairX,
  }: {
    model: MinimalModel
    exportSVG?: boolean
    crosshairX?: number
  }) {
    const { classes } = useStyles()
    const { lineZoneHeight, featuresVolatile } = model
    const [hovered, setHovered] = useState<HoveredLine>()
    const { n } = getLineGeometry(model)

    if (!featuresVolatile || n === 0) {
      return null
    }

    return (
      <>
        <Wrapper exportSVG={exportSVG} model={model}>
          <AllLines model={model} onHover={setHovered} />
          {hovered ? (
            <>
              <ConnectorLine
                mx={hovered.mx}
                gx={hovered.genomicX}
                lineZoneHeight={lineZoneHeight}
              />
              {hovered.feature.get('name') ? (
                <BaseTooltip>{hovered.feature.get('name')}</BaseTooltip>
              ) : null}
            </>
          ) : null}
          {crosshairX !== undefined && !hovered ? (
            <HighlightedLine model={model} crosshairX={crosshairX} />
          ) : null}
        </Wrapper>
        {!exportSVG ? (
          <ResizeHandle
            style={{ position: 'absolute', top: lineZoneHeight - 4 }}
            onDrag={d => {
              model.setLineZoneHeight(lineZoneHeight + d)
              return undefined
            }}
            className={classes.resizeHandle}
          />
        ) : null}
      </>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
