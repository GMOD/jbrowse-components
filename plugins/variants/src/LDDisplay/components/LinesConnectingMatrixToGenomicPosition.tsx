import { useCallback, useMemo, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, getSession, getStrokeProps } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import VariantLabels from './VariantLabels.tsx'
import Wrapper from './Wrapper.tsx'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  resizeHandle: {
    height: 5,
    boxSizing: 'border-box',
    background: 'transparent',
    '&:hover': {
      background: theme.palette.divider,
    },
  },
}))

function getGenomicX(
  view: LinearGenomeViewModel,
  assembly: { getCanonicalRefName2: (refName: string) => string },
  snp: { refName: string; start: number },
  offsetAdj: number,
) {
  return (
    (view.bpToPx({
      refName: assembly.getCanonicalRefName2(snp.refName),
      coord: snp.start,
    })?.offsetPx || 0) - offsetAdj
  )
}

function getViewTransform(model: SharedLDModel, view: LinearGenomeViewModel) {
  const viewScale =
    model.lastDrawnBpPerPx !== undefined
      ? model.lastDrawnBpPerPx / view.bpPerPx
      : 1
  const viewOffsetX =
    model.lastDrawnOffsetPx !== undefined
      ? model.lastDrawnOffsetPx * viewScale - view.offsetPx
      : 0
  return { viewScale, viewOffsetX }
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

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1)
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
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
  const { lineZoneHeight, snps, tickHeight } = model
  const { offsetPx, assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const blockWidth = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const n = snps.length
  const offsetAdj = Math.max(offsetPx, 0)
  const { viewScale, viewOffsetX } = getViewTransform(model, view)

  const pathD = useMemo(() => {
    if (!assembly || n === 0) {
      return ''
    }
    const parts = [] as string[]
    for (let i = 0; i < n; i++) {
      const gx = getGenomicX(view, assembly, snps[i]!, offsetAdj)
      const mx = getMatrixX(i, blockWidth, n, viewScale, viewOffsetX)
      parts.push(`M${mx} ${lineZoneHeight}L${gx} ${tickHeight}`)
      parts.push(`M${gx} 0L${gx} ${tickHeight}`)
    }
    return parts.join('')
  }, [assembly, n, snps, view, offsetAdj, blockWidth, lineZoneHeight, tickHeight, viewScale, viewOffsetX])

  const onMouseMove = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      if (!assembly || n === 0) {
        onHover(undefined)
        return
      }
      const svg =
        event.currentTarget instanceof SVGSVGElement
          ? event.currentTarget
          : event.currentTarget.ownerSVGElement
      if (!svg) {
        return
      }
      const rect = svg.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      let minDist = 10
      let found = -1
      let foundGx = 0
      for (let i = 0; i < n; i++) {
        const gx = getGenomicX(view, assembly, snps[i]!, offsetAdj)
        const mx = getMatrixX(i, blockWidth, n, viewScale, viewOffsetX)
        const d1 = pointToSegmentDist(px, py, mx, lineZoneHeight, gx, tickHeight)
        const d2 = pointToSegmentDist(px, py, gx, 0, gx, tickHeight)
        const dist = Math.min(d1, d2)
        if (dist < minDist) {
          minDist = dist
          found = i
          foundGx = gx
        }
      }
      onHover(
        found >= 0
          ? { snp: snps[found]!, idx: found, genomicX: foundGx }
          : undefined,
      )
    },
    [assembly, n, snps, view, offsetAdj, blockWidth, viewScale, viewOffsetX, lineZoneHeight, tickHeight, onHover],
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
        onMouseLeave={() => onHover(undefined)}
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
    const { lineZoneHeight, snps, tickHeight } = model
    const blockWidth = view.dynamicBlocks.contentBlocks[0]?.widthPx || 0
    const n = snps.length

    if (n === 0) {
      return null
    }

    const { viewScale, viewOffsetX } = getViewTransform(model, view)
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
                y2={tickHeight}
              />
              <line
                stroke="#f00c"
                strokeWidth={2}
                style={{ pointerEvents: 'none' }}
                x1={hovered.genomicX}
                x2={hovered.genomicX}
                y1={0}
                y2={tickHeight}
              />
              <BaseTooltip>{hovered.snp.id}</BaseTooltip>
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
