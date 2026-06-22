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

interface HoveredLine {
  feature: Feature
  idx: number
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
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, featuresVolatile } = model
  const { offsetPx, assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = view.totalWidthPxWithoutBorders
  const n = featuresVolatile?.length ?? 0
  const offsetAdj = Math.max(offsetPx, 0)

  const lineCoords = useMemo(() => {
    if (!assembly || !featuresVolatile || n === 0) {
      return []
    }
    const w = b0 / n
    return featuresVolatile.map((feature, i) => ({
      feature,
      idx: i,
      mx: i * w + w / 2,
      gx: getGenomicX(view, assembly, feature, offsetAdj),
    }))
  }, [assembly, featuresVolatile, n, b0, view, offsetAdj])

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
          ? { feature: found.feature, idx: found.idx, genomicX: found.gx }
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
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, featuresVolatile } = model
  const { offsetPx, assemblyNames } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = view.totalWidthPxWithoutBorders
  const n = featuresVolatile?.length ?? 0

  if (!assembly || !featuresVolatile || n === 0) {
    return null
  }

  const w = b0 / n
  const left = Math.max(0, -offsetPx)
  const svgX = crosshairX - left
  const idx = Math.floor(svgX / w)

  if (idx < 0 || idx >= n) {
    return null
  }

  const offsetAdj = Math.max(offsetPx, 0)
  const gx = getGenomicX(view, assembly, featuresVolatile[idx]!, offsetAdj)
  const mx = idx * w + w / 2

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
    const b0 = (getContainingView(model) as LinearGenomeViewModel)
      .totalWidthPxWithoutBorders
    const n = featuresVolatile?.length ?? 0

    if (!featuresVolatile || n === 0) {
      return null
    }

    const w = b0 / n
    const hMx = hovered ? hovered.idx * w + w / 2 : 0

    return (
      <>
        <Wrapper exportSVG={exportSVG} model={model}>
          <AllLines model={model} onHover={setHovered} />
          {hovered ? (
            <>
              <line
                stroke="#f00c"
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
                x1={hMx}
                x2={hovered.genomicX}
                y1={lineZoneHeight}
                y2={0}
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
