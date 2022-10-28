import React from 'react'
import { Typography, useTheme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { getSession, getTickDisplayStr } from '@jbrowse/core/util'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// locals
import {
  LinearGenomeViewModel,
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import { chooseGridPitch } from '../util'
import OverviewRubberBand from './OverviewRubberBand'

const wholeSeqSpacer = 2

const useStyles = makeStyles()(theme => ({
  scaleBar: {
    height: HEADER_OVERVIEW_HEIGHT,
  },
  scaleBarBorder: {
    border: '1px solid',
  },
  scaleBarContig: {
    backgroundColor: theme.palette.background.default,
    position: 'absolute',
    top: 0,
    height: HEADER_OVERVIEW_HEIGHT,
  },
  scaleBarContigForward: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 9'%3E%3Cpath d='M-.1 0L6 4.5L-.1 9' fill='none' stroke='%23ddd'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
  },
  scaleBarContigReverse: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 9'%3E%3Cpath d='M6 0L0 4.5L6 9' fill='none' stroke='%23ddd'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
  },

  scaleBarRefName: {
    position: 'absolute',
    fontWeight: 'bold',
    pointerEvents: 'none',
    zIndex: 100,
  },
  scaleBarLabel: {
    height: HEADER_OVERVIEW_HEIGHT,
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  scaleBarVisibleRegion: {
    position: 'absolute',
    height: HEADER_OVERVIEW_HEIGHT,
    pointerEvents: 'none',
    zIndex: 100,
    border: '1px solid',
  },
  overview: {
    height: HEADER_BAR_HEIGHT,
    position: 'relative',
  },
  overviewSvg: {
    width: '100%',
    position: 'absolute',
  },
}))

const Polygon = observer(
  ({
    model,
    overview,
    useOffset = true,
  }: {
    model: LGV
    overview: Base1DViewModel
    useOffset?: boolean
  }) => {
    const theme = useTheme()
    const multiplier = Number(useOffset)
    const { interRegionPaddingWidth, offsetPx, dynamicBlocks, cytobandOffset } =
      model
    const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks

    const { tertiary, primary } = theme.palette
    const polygonColor = tertiary ? tertiary.light : primary.light

    if (!contentBlocks.length) {
      return null
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    const topLeft =
      (overview.bpToPx({
        ...first,
        coord: first.reversed ? first.end : first.start,
      }) || 0) +
      cytobandOffset * multiplier
    const topRight =
      (overview.bpToPx({
        ...last,
        coord: last.reversed ? last.start : last.end,
      }) || 0) +
      cytobandOffset * multiplier

    const startPx = Math.max(0, -offsetPx)
    const endPx =
      startPx +
      totalWidthPxWithoutBorders +
      (contentBlocks.length * interRegionPaddingWidth) / 2

    const points = [
      [startPx, HEADER_BAR_HEIGHT],
      [endPx, HEADER_BAR_HEIGHT],
      [topRight, 0],
      [topLeft, 0],
    ]

    return (
      <polygon
        points={points.toString()}
        fill={alpha(polygonColor, 0.3)}
        stroke={alpha(polygonColor, 0.8)}
      />
    )
  },
)

type LGV = LinearGenomeViewModel

// rounded rect from https://stackoverflow.com/a/45889603/2129219
// prettier-ignore
function rightRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  return "M" + x + "," + y
       + "h" + (width - radius)
       + "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius
       + "v" + (height - 2 * radius)
       + "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius
       + "h" + (radius - width)
       + "z";
}

// prettier-ignore
function leftRoundedRect(x: number, y: number, width: number, height: number, radius: number ) {
  return "M" + (x + radius) + "," + y
       + "h" + (width - radius)
       + "v" + height
       + "h" + (radius - width)
       + "a" + radius + "," + radius + " 0 0 1 " + (-radius) + "," + (-radius)
       + "v" + (2 * radius - height)
       + "a" + radius + "," + radius + " 0 0 1 " + radius + "," + (-radius)
       + "z";
}

const colorMap: { [key: string]: string | undefined } = {
  gneg: 'rgb(227,227,227)',
  gpos25: 'rgb(142,142,142)',
  gpos50: 'rgb(85,85,85)',
  gpos100: 'rgb(0,0,0)',
  gpos75: 'rgb(57,57,57)',
  gvar: 'rgb(0,0,0)',
  stalk: 'rgb(127,127,127)',
  acen: '#800',
}

function getCytobands(assembly: Assembly | undefined, refName: string) {
  return (
    assembly?.cytobands
      ?.map(f => ({
        refName: assembly.getCanonicalRefName(f.get('refName')),
        start: f.get('start'),
        end: f.get('end'),
        type: f.get('type'),
      }))
      .filter(f => f.refName === refName) || []
  )
}

const Cytobands = observer(
  ({
    overview,
    block,
    assembly,
  }: {
    overview: Base1DViewModel
    assembly?: Assembly
    block: ContentBlock
  }) => {
    const { offsetPx, reversed } = block
    const cytobands = getCytobands(assembly, block.refName)
    const coords = cytobands.map(f => {
      const { refName, start, end, type } = f
      return [
        overview.bpToPx({
          refName,
          coord: start,
        }),
        overview.bpToPx({
          refName,
          coord: end,
        }),
        type,
      ]
    })

    const arr = cytobands || []
    const lcap = reversed ? arr.length - 1 : 0
    const rcap = reversed ? 0 : arr.length - 1

    let firstCent = true
    return (
      <g transform={`translate(-${offsetPx})`}>
        {coords.map(([start, end, type], index) => {
          const key = `${start}-${end}-${type}`
          if (type === 'acen' && firstCent) {
            firstCent = false
            return (
              <polygon
                key={key}
                points={[
                  [start, 0],
                  [end, HEADER_OVERVIEW_HEIGHT / 2],
                  [start, HEADER_OVERVIEW_HEIGHT],
                ].toString()}
                fill={colorMap[type]}
              />
            )
          }
          if (type === 'acen' && !firstCent) {
            return (
              <polygon
                key={key}
                points={[
                  [start, HEADER_OVERVIEW_HEIGHT / 2],
                  [end, 0],
                  [end, HEADER_OVERVIEW_HEIGHT],
                ].toString()}
                fill={colorMap[type]}
              />
            )
          }

          if (lcap === index) {
            return (
              <path
                key={key}
                d={leftRoundedRect(
                  Math.min(start, end),
                  0,
                  Math.abs(end - start),
                  HEADER_OVERVIEW_HEIGHT,
                  8,
                )}
                fill={colorMap[type]}
              />
            )
          } else if (rcap === index) {
            return (
              <path
                key={key}
                d={rightRoundedRect(
                  Math.min(start, end),
                  0,
                  Math.abs(end - start) - 2,
                  HEADER_OVERVIEW_HEIGHT,
                  8,
                )}
                fill={colorMap[type]}
              />
            )
          } else {
            return (
              <rect
                key={key}
                x={Math.min(start, end)}
                y={0}
                width={Math.abs(end - start)}
                height={HEADER_OVERVIEW_HEIGHT}
                fill={colorMap[type]}
              />
            )
          }
        })}
      </g>
    )
  },
)

const OverviewBox = observer(
  ({
    scale,
    model,
    block,
    overview,
  }: {
    scale: number
    model: LGV
    block: ContentBlock
    overview: Base1DViewModel
  }) => {
    const { classes, cx } = useStyles()
    const { cytobandOffset, showCytobands } = model
    const { start, end, reversed, refName, assemblyName } = block
    const { majorPitch } = chooseGridPitch(scale, 120, 15)
    const { assemblyManager } = getSession(model)
    const assembly = assemblyManager.get(assemblyName)
    const refNameColor = assembly?.getRefNameColor(refName)

    const tickLabels = []
    for (let i = 0; i < Math.floor((end - start) / majorPitch); i++) {
      const offsetLabel = (i + 1) * majorPitch
      tickLabels.push(reversed ? end - offsetLabel : start + offsetLabel)
    }

    const canDisplayCytobands =
      showCytobands && getCytobands(assembly, block.refName).length

    return (
      <div>
        {/* name of sequence */}
        <Typography
          style={{
            left: block.offsetPx + 3,
            color: canDisplayCytobands ? 'black' : refNameColor,
          }}
          className={classes.scaleBarRefName}
        >
          {refName}
        </Typography>
        <div
          className={cx(
            classes.scaleBarContig,
            canDisplayCytobands
              ? undefined
              : reversed
              ? classes.scaleBarContigReverse
              : classes.scaleBarContigForward,
            !canDisplayCytobands ? classes.scaleBarBorder : undefined,
          )}
          style={{
            left: block.offsetPx + cytobandOffset,
            width: block.widthPx,
            borderColor: refNameColor,
          }}
        >
          {!canDisplayCytobands
            ? tickLabels.map((tickLabel, labelIdx) => (
                <Typography
                  key={`${JSON.stringify(block)}-${tickLabel}-${labelIdx}`}
                  className={classes.scaleBarLabel}
                  variant="body2"
                  style={{
                    left: ((labelIdx + 1) * majorPitch) / scale,
                    pointerEvents: 'none',
                    color: refNameColor,
                  }}
                >
                  {getTickDisplayStr(tickLabel, overview.bpPerPx)}
                </Typography>
              ))
            : null}

          {canDisplayCytobands ? (
            <svg style={{ width: '100%' }}>
              <Cytobands
                overview={overview}
                assembly={assembly}
                block={block}
              />
            </svg>
          ) : null}
        </div>
      </div>
    )
  },
)

const ScaleBar = observer(
  ({
    model,
    scale,
    overview,
  }: {
    model: LGV
    overview: Base1DViewModel
    scale: number
  }) => {
    const { classes } = useStyles()
    const theme = useTheme()
    const { dynamicBlocks, showCytobands, cytobandOffset } = model
    const visibleRegions = dynamicBlocks.contentBlocks
    const overviewVisibleRegions = overview.dynamicBlocks

    const { tertiary, primary } = theme.palette
    const scaleBarColor = tertiary ? tertiary.light : primary.light

    if (!visibleRegions.length) {
      return null
    }
    const first = visibleRegions[0]
    const firstOverviewPx =
      overview.bpToPx({
        ...first,
        coord: first.reversed ? first.end : first.start,
      }) || 0

    const last = visibleRegions[visibleRegions.length - 1]
    const lastOverviewPx =
      overview.bpToPx({
        ...last,
        coord: last.reversed ? last.start : last.end,
      }) || 0

    const color = showCytobands ? '#f00' : scaleBarColor
    const transparency = showCytobands ? 0.1 : 0.3

    return (
      <div className={classes.scaleBar}>
        <div
          className={classes.scaleBarVisibleRegion}
          style={{
            width: lastOverviewPx - firstOverviewPx,
            left: firstOverviewPx + cytobandOffset,
            background: alpha(color, transparency),
            borderColor: color,
          }}
        />
        {/* this is the entire scale bar */}
        {overviewVisibleRegions.map((block, idx) => {
          return !(block instanceof ContentBlock) ? (
            <div
              key={`${JSON.stringify(block)}-${idx}`}
              className={classes.scaleBarContig}
              style={{
                width: block.widthPx,
                left: block.offsetPx,
                backgroundColor: '#999',
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
              }}
            />
          ) : (
            <OverviewBox
              scale={scale}
              block={block}
              model={model}
              overview={overview}
              key={`${JSON.stringify(block)}-${idx}`}
            />
          )
        })}
      </div>
    )
  },
)

function OverviewScaleBar({
  model,
  children,
}: {
  model: LGV
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const { totalBp, width, cytobandOffset, displayedRegions } = model

  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })

  const modWidth = width - cytobandOffset
  overview.setVolatileWidth(modWidth)
  overview.showAllRegions()

  const scale =
    totalBp / (modWidth - (displayedRegions.length - 1) * wholeSeqSpacer)

  return (
    <div>
      <OverviewRubberBand
        model={model}
        overview={overview}
        ControlComponent={
          <ScaleBar model={model} overview={overview} scale={scale} />
        }
      />
      <div className={classes.overview}>
        <svg height={HEADER_BAR_HEIGHT} className={classes.overviewSvg}>
          <Polygon model={model} overview={overview} />
        </svg>
        {children}
      </div>
    </div>
  )
}

export default observer(OverviewScaleBar)

export { Cytobands, Polygon }
