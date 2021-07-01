// import { Region } from '@jbrowse/core/util/types'
// import { Region as MSTRegion } from '@jbrowse/core/util/types/mst'
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { getSession } from '@jbrowse/core/util'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import LinearProgress from '@material-ui/core/LinearProgress'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import clsx from 'clsx'
import { Typography } from '@material-ui/core'
import {
  LinearGenomeViewStateModel,
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import { chooseGridPitch } from '../util'
import OverviewRubberBand from './OverviewRubberBand'

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
    scaleBarRegionIncompleteLeft: {
      width: 10,
      height: 17.5,
      background: `linear-gradient(-225deg,black 3px, transparent 1px),
      linear-gradient(45deg, black 3px, transparent 1px)`,
      backgroundRepeat: 'repeat-y',
      backgroundSize: '10px 8px',
      borderTopLeftRadius: '2px',
      borderBottomLeftRadius: '2px',
      float: 'left',
    },
    scaleBarRegionIncompleteRight: {
      width: 10,
      height: 17.5,
      background: `linear-gradient(225deg, black 3px, transparent 1px),
      linear-gradient(-45deg, black 3px, transparent 1px)`,
      backgroundRepeat: 'repeat-y',
      backgroundSize: '10px 8px',
      borderTopRightRadius: '2px',
      borderBottomRightRadius: '2px',
      float: 'right',
    },
    scaleBarRefName: {
      position: 'absolute',
      fontWeight: 'bold',
      lineHeight: 'normal',
      pointerEvents: 'none',
      left: 5,
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
      background: fade(scaleBarColor, 0.3),
      position: 'absolute',
      height: HEADER_OVERVIEW_HEIGHT,
      pointerEvents: 'none',
      top: -1,
      zIndex: 100,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: fade(scaleBarColor, 0.8),
      boxSizing: 'content-box',
    },
    overview: {
      height: HEADER_BAR_HEIGHT,
      position: 'relative',
    },
    overviewSvg: { position: 'absolute' },
  }
})

const wholeSeqSpacer = 2
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
    const {
      offsetPx,
      dynamicBlocks: { contentBlocks, totalWidthPxWithoutBorders },
    } = model

    const polygonColor = theme.palette.tertiary
      ? theme.palette.tertiary.light
      : theme.palette.primary.light

    if (!contentBlocks.length) {
      return null
    }
    const firstBlock = contentBlocks[0]
    const lastBlock = contentBlocks[contentBlocks.length - 1]
    const topLeft = overview.bpToPx({
      refName: firstBlock.refName,
      coord: firstBlock.reversed ? firstBlock.end : firstBlock.start,
      regionNumber: firstBlock.regionNumber,
    })
    const topRight = overview.bpToPx({
      refName: lastBlock.refName,
      coord: lastBlock.reversed ? lastBlock.start : lastBlock.end,
      regionNumber: lastBlock.regionNumber,
    })

    const startPx = Math.max(0, -offsetPx)
    const endPx =
      startPx +
      totalWidthPxWithoutBorders +
      (contentBlocks.length * model.interRegionPaddingWidth) / 2

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
        {points && (
          <polygon
            points={points.toString()}
            fill={fade(polygonColor, 0.3)}
            stroke={fade(polygonColor, 0.8)}
          />
        )}
      </svg>
    )
  },
)

type LGV = Instance<LinearGenomeViewStateModel>

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
    const { dynamicBlocks: visibleRegions } = model
    const { assemblyManager } = getSession(model)
    const gridPitch = chooseGridPitch(scale, 120, 15)
    const { dynamicBlocks: overviewVisibleRegions } = overview

    if (!visibleRegions.contentBlocks.length) {
      return null
    }
    const firstBlock = visibleRegions.contentBlocks[0]
    const firstOverviewPx =
      overview.bpToPx({
        refName: firstBlock.refName,
        regionNumber: firstBlock.regionNumber,
        coord: firstBlock.reversed ? firstBlock.end : firstBlock.start,
      }) || 0

    const lastBlock =
      visibleRegions.contentBlocks[visibleRegions.contentBlocks.length - 1]
    const lastOverviewPx =
      overview.bpToPx({
        refName: lastBlock.refName,
        coord: lastBlock.reversed ? lastBlock.start : lastBlock.end,
        regionNumber: lastBlock.regionNumber,
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
        {overviewVisibleRegions.map((seq, idx) => {
          const assembly = assemblyManager.get(seq.assemblyName)
          let refNameColor: string | undefined
          if (assembly) {
            refNameColor = assembly.getRefNameColor(seq.refName)
          }
          const regionLength = seq.end - seq.start
          const tickLabels = []
          for (
            let index = 0;
            index < Math.floor(regionLength / gridPitch.majorPitch);
            index++
          ) {
            const offsetLabel = (index + 1) * gridPitch.majorPitch
            tickLabels.push(
              seq.reversed ? seq.end - offsetLabel : seq.start + offsetLabel,
            )
          }

          return !(seq instanceof ContentBlock) ? (
            <div
              key={`${JSON.stringify(seq)}-${idx}`}
              className={classes.scaleBarContig}
              style={{
                width: seq.widthPx,
                left: seq.offsetPx,
                backgroundColor: '#999',
                backgroundImage:
                  'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
              }}
            />
          ) : (
            <div
              key={`${JSON.stringify(seq)}-${idx}`}
              className={clsx(
                classes.scaleBarContig,
                seq.reversed
                  ? classes.scaleBarContigReverse
                  : classes.scaleBarContigForward,
              )}
              style={{
                left: seq.offsetPx,
                width: seq.widthPx,
                borderColor: refNameColor,
              }}
            >
              {/* name of sequence */}
              <Typography
                style={{ color: refNameColor }}
                className={classes.scaleBarRefName}
              >
                {seq.refName}
              </Typography>

              {/* the number labels drawn in overview scale bar*/}
              {tickLabels.map((tickLabel, labelIdx) => (
                <Typography
                  key={`${JSON.stringify(seq)}-${tickLabel}-${labelIdx}`}
                  className={classes.scaleBarLabel}
                  variant="body2"
                  style={{
                    left: ((labelIdx + 1) * gridPitch.majorPitch) / scale,
                    pointerEvents: 'none',
                    color: refNameColor,
                  }}
                >
                  {tickLabel.toLocaleString('en-US')}
                </Typography>
              ))}
            </div>
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
  const { width, displayedRegions } = model

  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })
  overview.setVolatileWidth(width)
  overview.showAllRegions()

  const scale =
    model.totalBp / (width - (displayedRegions.length - 1) * wholeSeqSpacer)

  return !displayedRegions.length ? (
    <>
      <div className={classes.scaleBar}>
        <LinearProgress
          variant="indeterminate"
          style={{ marginTop: 4, width: '100%' }}
        />
      </div>
      <div>{children}</div>
    </>
  ) : (
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
