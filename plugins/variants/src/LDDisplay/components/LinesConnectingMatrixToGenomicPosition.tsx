import { forwardRef, isValidElement, useState } from 'react'

import { ResizeHandle, SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingView,
  getSession,
  getStrokeProps,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

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

const Wrapper = observer(function Wrapper({
  children,
  model,
  exportSVG,
  yOffset = 0,
}: {
  model: SharedLDModel
  children: React.ReactNode
  exportSVG?: boolean
  yOffset?: number
}) {
  const { height } = model
  const { width, offsetPx } = getContainingView(model) as LinearGenomeViewModel
  const left = Math.max(0, -offsetPx)
  return exportSVG ? (
    <g transform={`translate(${left} ${yOffset})`}>{children}</g>
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

interface MouseOverLine {
  snp: { id: string; refName: string; start: number; end: number }
  idx: number
  genomicX: number
}

interface Props {
  message: React.ReactNode | string
}

const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {isValidElement(message) ? (
          message
        ) : message ? (
          <SanitizedHTML html={String(message)} />
        ) : null}
      </div>
    )
  },
)

const LineTooltip = observer(function LineTooltip({
  contents,
}: {
  contents?: string
}) {
  return contents ? (
    <BaseTooltip>
      <TooltipContents message={contents} />
    </BaseTooltip>
  ) : null
})

const AllLines = observer(function AllLines({
  model,
  setMouseOverLine,
}: {
  model: SharedLDModel
  setMouseOverLine: (arg: MouseOverLine | undefined) => void
}) {
  const theme = useTheme()
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, snps, showLabels, tickHeight, useGenomicPositions } =
    model
  const { offsetPx, assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const n = snps.length
  const l = Math.max(offsetPx, 0)
  const p = getStrokeProps(alpha(theme.palette.text.primary, 0.4))

  if (!assembly || n === 0) {
    return null
  }

  return (
    <>
      {snps.map((snp, i) => {
        const ref = snp.refName
        const genomicX =
          (view.bpToPx({
            refName: assembly.getCanonicalRefName2(ref),
            coord: snp.start,
          })?.offsetPx || 0) - l

        // Matrix column position: use genomic position or uniform distribution
        const matrixX = useGenomicPositions ? genomicX : ((i + 0.5) * b0) / n

        return (
          <g
            key={`${snp.id}-${i}`}
            onMouseEnter={() => {
              setMouseOverLine({ snp, idx: i, genomicX })
            }}
            onMouseLeave={() => {
              setMouseOverLine(undefined)
            }}
          >
            {/* Main connecting line */}
            <line
              {...p}
              strokeWidth={1}
              x1={matrixX}
              x2={genomicX}
              y1={lineZoneHeight}
              y2={tickHeight}
            />
            {/* Vertical tick mark at genomic position */}
            <line
              {...p}
              strokeWidth={1}
              x1={genomicX}
              x2={genomicX}
              y1={0}
              y2={tickHeight}
            />
            {/* Variant label */}
            {showLabels ? (
              <text
                x={genomicX}
                y={0}
                transform={`rotate(-60, ${genomicX}, 0)`}
                fontSize={10}
                textAnchor="start"
                dominantBaseline="middle"
                fill={theme.palette.text.primary}
                style={{ pointerEvents: 'none' }}
              >
                {snp.id}
              </text>
            ) : null}
          </g>
        )
      })}
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
    const [mouseOverLine, setMouseOverLine] = useState<MouseOverLine>()
    const { lineZoneHeight, snps, useGenomicPositions } = model
    const { dynamicBlocks } = view
    const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
    const n = snps.length

    if (n === 0) {
      return null
    }

    // Calculate matrix X position for highlighted line
    const highlightMatrixX = mouseOverLine
      ? useGenomicPositions
        ? mouseOverLine.genomicX
        : ((mouseOverLine.idx + 0.5) * b0) / n
      : 0

    return (
      <>
        <Wrapper exportSVG={exportSVG} model={model} yOffset={yOffset}>
          <AllLines model={model} setMouseOverLine={setMouseOverLine} />
          {mouseOverLine ? (
            <>
              <line
                stroke="#f00c"
                strokeWidth={2}
                style={{
                  pointerEvents: 'none',
                }}
                x1={highlightMatrixX}
                x2={mouseOverLine.genomicX}
                y1={lineZoneHeight}
                y2={model.tickHeight}
              />
              <line
                stroke="#f00c"
                strokeWidth={2}
                style={{
                  pointerEvents: 'none',
                }}
                x1={mouseOverLine.genomicX}
                x2={mouseOverLine.genomicX}
                y1={0}
                y2={model.tickHeight}
              />
              <LineTooltip contents={mouseOverLine.snp.id} />
            </>
          ) : null}
        </Wrapper>
        {!exportSVG ? (
          <ResizeHandle
            style={{
              position: 'absolute',
              top: lineZoneHeight - 4,
            }}
            onDrag={d => model.setLineZoneHeight(lineZoneHeight + d)}
            className={classes.resizeHandle}
          />
        ) : null}
      </>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
