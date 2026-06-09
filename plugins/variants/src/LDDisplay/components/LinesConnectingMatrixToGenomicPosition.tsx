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

import VariantLabels from './VariantLabels.tsx'
import Wrapper from './Wrapper.tsx'
import { pointToSegmentDist, svgMousePoint } from '../../util.ts'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  resizeHandle: {
    height: 5,
    boxSizing: 'border-box',
  },
})

// SNP position in viewport-canvas-x: bpToPx returns the absolute genome
// pixel, subtract view.offsetPx to get viewport-relative.
function getGenomicX(
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  snp: { refName: string; start: number },
) {
  const abs =
    view.bpToPx({
      refName: assembly.getCanonicalRefName2(snp.refName),
      coord: snp.start,
    })?.offsetPx ?? 0
  return abs - view.offsetPx
}

function getMatrixX(
  idx: number,
  blockWidth: number,
  n: number,
  viewScale: number,
  viewOffsetX: number,
) {
  return (((idx + 0.5) * blockWidth) / n) * viewScale + viewOffsetX
}

interface HoveredLine {
  snp: { id: string; refName: string; start: number; end: number }
  idx: number
  genomicX: number
}

const AllLines = observer(function AllLines({
  model,
  onHover,
}: {
  model: SharedLDModel
  onHover: (arg: HoveredLine | undefined) => void
}) {
  const theme = useTheme()
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, snps } = model
  const { assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const blockWidth = dynamicBlocks.totalWidthPxWithoutBorders
  const n = snps.length
  const { scale: viewScale, viewOffsetX } = model.renderTransform

  const lineCoords = useMemo(() => {
    if (!assembly || n === 0) {
      return []
    }
    return snps.map((snp, i) => ({
      snp,
      idx: i,
      mx: getMatrixX(i, blockWidth, n, viewScale, viewOffsetX),
      gx: getGenomicX(view, assembly, snp),
    }))
  }, [assembly, n, snps, blockWidth, viewScale, viewOffsetX, view])

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
          ? { snp: found.snp, idx: found.idx, genomicX: found.gx }
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
        strokeWidth={1}
        fill="none"
        style={{ pointerEvents: 'none' }}
      />
      <VariantLabels model={model} />
    </>
  )
})

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
    yOffset = 0,
  }: {
    model: SharedLDModel
    exportSVG?: boolean
    yOffset?: number
  }) {
    const { classes } = useStyles()
    const view = getContainingView(model) as LinearGenomeViewModel
    const [hovered, setHovered] = useState<HoveredLine>()
    const { lineZoneHeight, snps } = model
    const blockWidth = view.dynamicBlocks.totalWidthPxWithoutBorders
    const n = snps.length

    if (n === 0) {
      return null
    }

    const { scale: viewScale, viewOffsetX } = model.renderTransform
    const hMx = hovered
      ? getMatrixX(hovered.idx, blockWidth, n, viewScale, viewOffsetX)
      : 0

    return (
      <>
        <Wrapper exportSVG={exportSVG} model={model} yOffset={yOffset}>
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
              {hovered.snp.id ? (
                <BaseTooltip>{hovered.snp.id}</BaseTooltip>
              ) : null}
            </>
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
