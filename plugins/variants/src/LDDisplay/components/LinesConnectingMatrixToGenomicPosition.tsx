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

import type { LDDisplayModel } from '../model.ts'
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
}: {
  model: LDDisplayModel
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
  model: LDDisplayModel
  setMouseOverLine: (arg: MouseOverLine | undefined) => void
}) {
  const theme = useTheme()
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, snps } = model
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

        // Matrix column position: uniform distribution across view width
        const matrixX = ((i + 0.5) * b0) / n

        return (
          <line
            {...p}
            strokeWidth={1}
            key={`${snp.id}-${i}`}
            x1={matrixX}
            x2={genomicX}
            y1={lineZoneHeight}
            y2={0}
            onMouseEnter={() => {
              setMouseOverLine({ snp, idx: i, genomicX })
            }}
            onMouseLeave={() => {
              setMouseOverLine(undefined)
            }}
          />
        )
      })}
    </>
  )
})

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
  }: {
    model: LDDisplayModel
    exportSVG?: boolean
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

    return (
      <>
        <Wrapper exportSVG={exportSVG} model={model}>
          <AllLines model={model} setMouseOverLine={setMouseOverLine} />
          {mouseOverLine ? (
            <>
              <line
                stroke="#f00c"
                strokeWidth={2}
                style={{
                  pointerEvents: 'none',
                }}
                x1={(mouseOverLine.idx + 0.5) * b0 / n}
                x2={mouseOverLine.genomicX}
                y1={lineZoneHeight}
                y2={0}
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
