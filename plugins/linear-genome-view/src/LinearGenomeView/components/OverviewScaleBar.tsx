import React from 'react'
import { Typography, makeStyles, useTheme, alpha } from '@material-ui/core'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import clsx from 'clsx'

import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { getSession } from '@jbrowse/core/util'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// locals
import {
  LinearGenomeViewStateModel,
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import { chooseGridPitch } from '../util'
import OverviewRubberBand from './OverviewRubberBand'

const wholeSeqSpacer = 2

const useStyles = makeStyles(theme => {
  const scaleBarColor = theme.palette.tertiary
    ? theme.palette.tertiary.light
    : theme.palette.primary.light
  return {
    scaleBar: {
      width: '100%',
      height: HEADER_OVERVIEW_HEIGHT,
      overflow: 'hidden',
    },
    scaleBarContig: {
      backgroundColor: theme.palette.background.default,
      position: 'absolute',
      top: 0,
      height: HEADER_OVERVIEW_HEIGHT,
      border: '1px solid',
      borderBottomColor: 'black',
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
      lineHeight: 'normal',
      pointerEvents: 'none',
      left: 5,
      zIndex: 100,
    },
    scaleBarLabel: {
      height: HEADER_OVERVIEW_HEIGHT,
      width: 1,
      position: 'absolute',
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
    },
    scaleBarVisibleRegion: {
      background: alpha(scaleBarColor, 0.1),
      position: 'absolute',
      height: HEADER_OVERVIEW_HEIGHT,
      pointerEvents: 'none',
      zIndex: 100,
      border: '1px solid red',
    },
    overview: {
      height: HEADER_BAR_HEIGHT,
      position: 'relative',
    },
    overviewSvg: {
      position: 'absolute',
    },
  }
})

const Polygon = observer(
  ({
    model,
    overview,
  }: {
    model: LGV
    overview: Instance<Base1DViewModel>
  }) => {
    const theme = useTheme()
    const classes = useStyles()
    const { interRegionPaddingWidth, offsetPx, dynamicBlocks } = model
    const { contentBlocks, totalWidthPxWithoutBorders } = dynamicBlocks
    const { tertiary, primary } = theme.palette
    const polygonColor = tertiary ? tertiary.light : primary.light

    if (!contentBlocks.length) {
      return null
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    const topLeft = overview.bpToPx({
      ...first,
      coord: first.reversed ? first.end : first.start,
    })
    const topRight = overview.bpToPx({
      ...last,
      coord: last.reversed ? last.start : last.end,
    })

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
      <svg
        height={HEADER_BAR_HEIGHT}
        width="100%"
        className={classes.overviewSvg}
      >
        <polygon
          points={points.toString()}
          fill={alpha(polygonColor, 0.3)}
          stroke={alpha(polygonColor, 0.8)}
        />
      </svg>
    )
  },
)

type LGV = Instance<LinearGenomeViewStateModel>

const colorMap: { [key: string]: string | undefined } = {
  gneg: '#ccc',
  gpos25: '#aaa',
  gpos50: '#888',
  gpos100: '#333',
  gpos75: '#666',
  gvar: 'black',
  stalk: 'brown',
  acen: '#800',
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
    const cytobands = assembly?.cytobands
      ?.map(f => ({
        refName: assembly.getCanonicalRefName(f.get('refName')),
        start: f.get('start'),
        end: f.get('end'),
        type: f.get('type'),
      }))
      .filter(f => f.refName === block.refName)
      .map(f => [
        overview.bpToPx({
          refName: f.refName,
          coord: f.start,
        }),
        overview.bpToPx({
          refName: f.refName,
          coord: f.end,
        }),
        f.type,
      ])

    let firstCent = true
    return cytobands ? (
      <svg style={{ width: '100%' }}>
        <g transform={`translate(-${block.offsetPx})`}>
          {cytobands.map(([start, end, type]) => {
            if (type === 'acen' && firstCent) {
              firstCent = false
              return (
                <polygon
                  key={`${start}-${end}-${type}`}
                  points={[
                    [start, 0],
                    [end, (HEADER_OVERVIEW_HEIGHT - 2) / 2],
                    [start, HEADER_OVERVIEW_HEIGHT - 2],
                  ].toString()}
                  fill={colorMap[type]}
                />
              )
            }
            if (type === 'acen' && !firstCent) {
              return (
                <polygon
                  key={`${start}-${end}-${type}`}
                  points={[
                    [start, (HEADER_OVERVIEW_HEIGHT - 2) / 2],
                    [end, 0],
                    [end, HEADER_OVERVIEW_HEIGHT - 2],
                  ].toString()}
                  fill={colorMap[type]}
                />
              )
            }
            return (
              <rect
                key={`${start}-${end}-${type}`}
                x={Math.min(start, end)}
                y={0}
                width={Math.abs(end - start)}
                height={HEADER_OVERVIEW_HEIGHT - 2}
                fill={colorMap[type]}
              />
            )
          })}
        </g>
      </svg>
    ) : null
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
    const classes = useStyles()
    const { showIdeogram } = model
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

    return (
      <div
        className={clsx(
          classes.scaleBarContig,
          reversed
            ? classes.scaleBarContigReverse
            : classes.scaleBarContigForward,
        )}
        style={{
          left: block.offsetPx,
          width: block.widthPx,
          borderColor: refNameColor,
        }}
      >
        {/* name of sequence */}
        <Typography
          style={{ color: refNameColor }}
          className={classes.scaleBarRefName}
        >
          {refName}
        </Typography>

        {!assembly?.cytobands?.length || !showIdeogram
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
                {tickLabel.toLocaleString('en-US')}
              </Typography>
            ))
          : null}

        {assembly?.cytobands && showIdeogram ? (
          <Cytobands overview={overview} assembly={assembly} block={block} />
        ) : null}
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
    const classes = useStyles()
    const visibleRegions = model.dynamicBlocks.contentBlocks
    const overviewVisibleRegions = overview.dynamicBlocks

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

    return (
      <div className={classes.scaleBar}>
        <div
          className={classes.scaleBarVisibleRegion}
          style={{
            width: lastOverviewPx - firstOverviewPx,
            left: firstOverviewPx,
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
  const classes = useStyles()
  const { totalBp, width, displayedRegions } = model

  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })
  overview.setVolatileWidth(width)
  overview.showAllRegions()

  const scale =
    totalBp / (width - (displayedRegions.length - 1) * wholeSeqSpacer)

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
        <Polygon model={model} overview={overview} />
        {children}
      </div>
    </div>
  )
}

export default observer(OverviewScaleBar)

export { Cytobands }
