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

interface MouseOverLine {
  f: Feature
  idx: number
  c: number
}

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
  }: {
    model: MinimalModel
    exportSVG?: boolean
  }) {
    const { classes } = useStyles()
    const { assemblyManager } = getSession(model)
    const view = getContainingView(model) as LinearGenomeViewModel
    const [mouseOverLine, setMouseOverLine] = useState<MouseOverLine>()
    const { lineZoneHeight, featuresVolatile } = model
    const { assemblyNames, dynamicBlocks } = view
    const assembly = assemblyManager.get(assemblyNames[0]!)
    const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
    const w = b0 / (featuresVolatile?.length || 1)
    return assembly && featuresVolatile ? (
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
                x1={mouseOverLine.idx * w + w / 2}
                x2={mouseOverLine.c}
                y1={lineZoneHeight}
                y2={0}
                onMouseLeave={() => {
                  setMouseOverLine(undefined)
                }}
              />
              <LineTooltip contents={mouseOverLine.f.get('name')} />
            </>
          ) : null}
        </Wrapper>
        {!exportSVG ? (
          <ResizeHandle
            style={{
              position: 'absolute',
              top: lineZoneHeight - 4,
            }}
            onDrag={n => model.setLineZoneHeight(lineZoneHeight + n)}
            className={classes.resizeHandle}
          />
        ) : null}
      </>
    ) : null
  },
)
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
  model: MinimalModel
  setMouseOverLine: (arg: any) => void
}) {
  const theme = useTheme()
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, featuresVolatile } = model
  const { offsetPx, assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const b0 = dynamicBlocks.contentBlocks[0]?.widthPx || 0
  const w = b0 / (featuresVolatile?.length || 1)
  const l = Math.max(offsetPx, 0)
  const p = getStrokeProps(alpha(theme.palette.text.primary, 0.4))
  return assembly && featuresVolatile ? (
    <>
      {featuresVolatile.map((f, i) => {
        const ref = f.get('refName')
        const c =
          (view.bpToPx({
            refName: assembly.getCanonicalRefName2(ref),
            coord: f.get('start'),
          })?.offsetPx || 0) - l
        return (
          <line
            {...p}
            strokeWidth={1}
            key={f.id()}
            x1={i * w + w / 2}
            x2={c}
            y1={lineZoneHeight}
            y2={0}
            onMouseEnter={() => {
              setMouseOverLine({ f, idx: i, c })
            }}
            onMouseLeave={() => {
              setMouseOverLine(undefined)
            }}
          />
        )
      })}
    </>
  ) : null
})

export default LinesConnectingMatrixToGenomicPosition
