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
  offsetAdjustment: number,
) {
  return (
    (view.bpToPx({
      refName: assembly.getCanonicalRefName2(snp.refName),
      coord: snp.start,
    })?.offsetPx || 0) - offsetAdjustment
  )
}

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
  const { lineZoneHeight, snps, tickHeight } = model
  const { offsetPx, assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const n = snps.length
  const offsetAdj = Math.max(offsetPx, 0)
  const strokeProps = getStrokeProps(alpha(theme.palette.text.primary, 0.4))

  if (!assembly || n === 0) {
    return null
  }

  return (
    <>
      {snps.map((snp, i) => {
        const genomicX = getGenomicX(view, assembly, snp, offsetAdj)
        const matrixX = ((i + 0.5) * b0) / n
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
            <line
              {...strokeProps}
              strokeWidth={1}
              x1={matrixX}
              x2={genomicX}
              y1={lineZoneHeight}
              y2={tickHeight}
            />
            <line
              {...strokeProps}
              strokeWidth={1}
              x1={genomicX}
              x2={genomicX}
              y1={0}
              y2={tickHeight}
            />
          </g>
        )
      })}
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
    const [mouseOverLine, setMouseOverLine] = useState<MouseOverLine>()
    const { lineZoneHeight, snps } = model
    const { dynamicBlocks } = view
    const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
    const n = snps.length

    if (n === 0) {
      return null
    }

    const highlightMatrixX = mouseOverLine
      ? ((mouseOverLine.idx + 0.5) * b0) / n
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
