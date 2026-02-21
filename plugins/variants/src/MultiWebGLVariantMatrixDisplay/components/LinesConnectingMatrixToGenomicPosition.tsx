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

import { pointToSegmentDist } from '../../util.ts'

import type { Feature } from '@jbrowse/core/util'
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
    })?.offsetPx || 0) - offsetAdj
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
  const { offsetPx, assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const n = featuresVolatile?.length || 0
  const w = b0 / (n || 1)
  const offsetAdj = Math.max(offsetPx, 0)

  const pathD = useMemo(() => {
    if (!assembly || n === 0 || !featuresVolatile) {
      return ''
    }
    const parts = [] as string[]
    for (let i = 0; i < n; i++) {
      const gx = getGenomicX(view, assembly, featuresVolatile[i]!, offsetAdj)
      const mx = i * w + w / 2
      parts.push(`M${mx} ${lineZoneHeight}L${gx} 0`)
    }
    return parts.join('')
  }, [assembly, n, featuresVolatile, view, offsetAdj, w, lineZoneHeight])

  const onMouseMove = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      if (!assembly || n === 0 || !featuresVolatile) {
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
        const gx = getGenomicX(view, assembly, featuresVolatile[i]!, offsetAdj)
        const mx = i * w + w / 2
        const dist = pointToSegmentDist(px, py, mx, lineZoneHeight, gx, 0)
        if (dist < minDist) {
          minDist = dist
          found = i
          foundGx = gx
        }
      }
      onHover(
        found >= 0
          ? { feature: featuresVolatile[found]!, idx: found, genomicX: foundGx }
          : undefined,
      )
    },
    [
      assembly,
      n,
      featuresVolatile,
      view,
      offsetAdj,
      w,
      lineZoneHeight,
      onHover,
    ],
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
    </>
  )
})

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
  }: {
    model: MinimalModel
    exportSVG?: boolean
  }) {
    const { classes } = useStyles()
    const { lineZoneHeight, featuresVolatile } = model
    const [hovered, setHovered] = useState<HoveredLine>()
    const b0 =
      (getContainingView(model) as LinearGenomeViewModel).dynamicBlocks
        .contentBlocks[0]?.widthPx || 0
    const n = featuresVolatile?.length || 0
    const w = b0 / (n || 1)

    if (!featuresVolatile || n === 0) {
      return null
    }

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
              <BaseTooltip>{hovered.feature.get('name')}</BaseTooltip>
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
