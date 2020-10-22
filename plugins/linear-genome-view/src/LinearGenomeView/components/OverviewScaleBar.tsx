// import { Region } from '@jbrowse/core/util/types'
// import { Region as MSTRegion } from '@jbrowse/core/util/types/mst'
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { getSession } from '@jbrowse/core/util'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import LinearProgress from '@material-ui/core/LinearProgress'
import Paper from '@material-ui/core/Paper'
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
  const background = theme.palette.background.default
  return {
    scaleBar: {
      display: 'flex',
      width: '100%',
      height: HEADER_OVERVIEW_HEIGHT,
      overflow: 'hidden',
    },
    scaleBarContig: {
      backgroundColor: theme.palette.background.default,
      position: 'relative',
      borderColor: theme.palette.text.primary,
      borderBottomColor: 'black',
    },
    scaleBarContigForward: {
      backgroundImage: `
      linear-gradient(-45deg, ${background} 10px, transparent 10px), 
      linear-gradient(-135deg, ${background} 10px, transparent 10px),
      linear-gradient(-45deg, #e4e4e4 11px, transparent 12px),
      linear-gradient(-135deg, #e4e4e4 11px, transparent 12px),
      linear-gradient(-45deg, ${background} 10px, transparent 10px),
      linear-gradient(-135deg, ${background} 10px, transparent 10px)`,
      backgroundRepeat: 'repeat',
      backgroundSize: HEADER_OVERVIEW_HEIGHT,
    },
    scaleBarContigReverse: {
      backgroundImage: `
      linear-gradient(45deg, ${background} 10px, transparent 10px), 
      linear-gradient(135deg, ${background} 10px, transparent 10px),
      linear-gradient(45deg, #e4e4e4 11px, transparent 12px),
      linear-gradient(135deg, #e4e4e4 11px, transparent 12px),
      linear-gradient(45deg, ${background} 10px, transparent 10px),
      linear-gradient(135deg, ${background} 10px, transparent 10px)`,
      backgroundRepeat: 'repeat',
      backgroundSize: HEADER_OVERVIEW_HEIGHT,
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
      height: '100%',
      background: fade(scaleBarColor, 0.3),
      position: 'absolute',
      top: -1,
      borderWidth: 1,
      borderStyle: 'solid',
      // @ts-ignore
      borderColor: fade(scaleBarColor, 0.8),
      boxSizing: 'content-box',
    },
    overview: {
      height: HEADER_BAR_HEIGHT,
      position: 'relative',
    },
    overviewSvg: { display: 'block', position: 'absolute' },
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
    const { offsetPx, width, bpPerPx, dynamicBlocks: visibleRegions } = model

    const blocks = visibleRegions
      .getBlocks()
      .filter(block => block.refName !== undefined)
    overview.setVolatileWidth(width)
    overview.showAllRegions()
    const polygonColor = theme.palette.tertiary
      ? theme.palette.tertiary.light
      : theme.palette.primary.light

    let bottomLeft: number | undefined
    let newTopLeft: number | undefined
    let points: (number | undefined)[][] = []
    // Iterating over blocks to find the rightmost (endPx and topRight)
    // and leftmost (startPx and topLeft) points in order to draw a single polygon
    blocks.forEach((region, index) => {
      const startPx = region.offsetPx - offsetPx
      const endPx = startPx + (region.end - region.start) / bpPerPx
      let topLeft = overview.bpToPx({
        refName: region.refName,
        coord: region.start,
        regionNumber: region.regionNumber,
      })
      let topRight = overview.bpToPx({
        refName: region.refName,
        coord: region.end,
        regionNumber: region.regionNumber,
      })
      //  p1 right to -> p2  up to -> p3  left to -> p4 and back down to p1
      if (region.reversed) {
        ;[topLeft, topRight] = [topRight, topLeft]
      }
      if (index === 0) {
        // leftmost bottom and top points
        bottomLeft = startPx
        newTopLeft = topLeft
      }
      points = [
        [startPx, HEADER_BAR_HEIGHT],
        [endPx, HEADER_BAR_HEIGHT],
        [topRight, 0],
        [topLeft, 0],
      ]
      if (index === blocks.length - 1) {
        points = [
          [bottomLeft, HEADER_BAR_HEIGHT],
          [endPx, HEADER_BAR_HEIGHT],
          [topRight, 0],
          [newTopLeft, 0],
        ]
      }
    })
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

const ScaleBar = observer(({ model, scale }: { model: LGV; scale: number }) => {
  const classes = useStyles()
  const { displayedRegions, dynamicBlocks: visibleRegions } = model
  const { assemblyManager } = getSession(model)
  const gridPitch = chooseGridPitch(scale, 120, 15)

  return (
    <div className={classes.scaleBar}>
      {/* this is the entire scale bar */}
      {displayedRegions.map((seq, idx) => {
        const assembly = assemblyManager.get(seq.assemblyName)
        let refNameColor: string | undefined
        if (assembly) {
          refNameColor = assembly.getRefNameColor(seq.refName)
        }
        const regionLength = seq.end - seq.start
        // boolean if displayed region length is smaller than its parent's
        const incompleteRegion =
          seq.parentEnd - seq.parentStart > seq.end - seq.start
        // number of labels to draw in the overview scale bar
        const numLabels = Math.floor(regionLength / gridPitch.majorPitch)
        // calculating the number labels
        const base = seq.reversed
          ? Math.ceil(seq.end / gridPitch.minorPitch) * gridPitch.minorPitch
          : Math.ceil(seq.start / gridPitch.minorPitch) * gridPitch.minorPitch
        const tickLabels = []
        for (let index = 0; index < numLabels; index++) {
          const offsetLabel = (index + 1) * gridPitch.majorPitch
          const tickLabel = seq.reversed
            ? base - offsetLabel
            : base + offsetLabel
          tickLabels.push(tickLabel)
        }
        return (
          <Paper
            key={`${JSON.stringify(seq)}-${idx.toLocaleString('en-US')}`}
            variant="outlined"
            className={clsx(
              classes.scaleBarContig,
              seq.reversed
                ? classes.scaleBarContigReverse
                : classes.scaleBarContigForward,
            )}
            style={{
              minWidth: regionLength / scale,
              marginRight:
                idx === displayedRegions.length - 1
                  ? undefined
                  : wholeSeqSpacer,
              borderColor: refNameColor,
            }}
          >
            {incompleteRegion && (
              <div
                className={classes.scaleBarRegionIncompleteLeft}
                style={{
                  backgroundImage: `linear-gradient(-225deg, ${refNameColor} 3px, transparent 1px),
                linear-gradient(45deg, ${refNameColor} 3px, transparent 1px)`,
                  backgroundSize: '10px 8px',
                  backgroundRepeat: 'repeat-y',
                }}
              />
            )}
            {/* name of sequence */}
            <Typography
              style={{ color: refNameColor }}
              className={classes.scaleBarRefName}
            >
              {seq.refName}
            </Typography>

            {/* where the rubberband selection boxes actually get drawn */}
            {visibleRegions.map((r, visibleRegionIdx) => {
              if (
                seq.assemblyName === r.assemblyName &&
                seq.refName === r.refName &&
                r.regionNumber === idx
              ) {
                const leftStyle = r.reversed
                  ? (seq.end - r.end) / scale - 1
                  : (r.start - seq.start) / scale - 1
                return (
                  <div
                    key={`${r.key}-${visibleRegionIdx}`}
                    className={classes.scaleBarVisibleRegion}
                    style={{
                      width: Math.max((r.end - r.start) / scale, 1),
                      left: leftStyle,
                      pointerEvents: 'none',
                    }}
                  />
                )
              }
              return null
            })}
            {/* the number labels drawn in overview scale bar*/}
            {tickLabels.map((tickLabel, labelIdx) => (
              <div
                key={`${JSON.stringify(seq)}-${tickLabel}-${labelIdx}`}
                className={classes.scaleBarLabel}
                style={{
                  left: ((labelIdx + 0.95) * gridPitch.majorPitch) / scale,
                  pointerEvents: 'none',
                  color: refNameColor,
                }}
              >
                {tickLabel.toLocaleString('en-US')}
              </div>
            ))}
            {incompleteRegion && (
              <div
                className={classes.scaleBarRegionIncompleteRight}
                style={{
                  backgroundImage: `linear-gradient(225deg, ${refNameColor} 3px, transparent 1px),
              linear-gradient(-45deg, ${refNameColor} 3px, transparent 1px)`,
                  backgroundSize: '10px 8px',
                  backgroundRepeat: 'repeat-y',
                }}
              />
            )}
          </Paper>
        )
      })}
    </div>
  )
})

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
  })

  const scale =
    model.totalBp / (width - (displayedRegions.length - 1) * wholeSeqSpacer)

  if (!displayedRegions.length) {
    return (
      <>
        <div className={classes.scaleBar}>
          <LinearProgress
            variant="indeterminate"
            style={{ marginTop: 4, width: '100%' }}
          />
        </div>
        <div>{children}</div>
      </>
    )
  }

  return (
    <div>
      <OverviewRubberBand
        model={model}
        overview={overview}
        ControlComponent={<ScaleBar model={model} scale={scale} />}
      />
      <div className={classes.overview}>
        <Polygon model={model} overview={overview} />
        {children}
      </div>
    </div>
  )
}

export default observer(OverviewScaleBar)
