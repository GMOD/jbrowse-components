// import { Region } from '@gmod/jbrowse-core/util/types'
// import { Region as MSTRegion } from '@gmod/jbrowse-core/util/types/mst'
import Base1DView, {
  Base1DViewModel,
} from '@gmod/jbrowse-core/util/Base1DViewModel'
import { getSession } from '@gmod/jbrowse-core/util'
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
  // @ts-ignore
  const scaleBarColor = theme.palette.tertiary
    ? // prettier-ignore
      // @ts-ignore
      theme.palette.tertiary.light
    : theme.palette.primary.light
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
    },
    scaleBarContigForward: {
      backgroundImage: `
      linear-gradient(-45deg, ${theme.palette.background.default} 10px, transparent 10px), 
      linear-gradient(-135deg, ${theme.palette.background.default} 10px, transparent 10px),
      linear-gradient(-45deg, #cccccc 11px, transparent 12px),
      linear-gradient(-135deg, #cccccc 11px, transparent 12px),
      linear-gradient(-45deg, ${theme.palette.background.default} 10px, transparent 10px),
      linear-gradient(-135deg, ${theme.palette.background.default} 10px, transparent 10px)`,
      backgroundRepeat: 'repeat',
      backgroundSize: HEADER_OVERVIEW_HEIGHT,
    },
    scaleBarContigReverse: {
      backgroundImage: `
      linear-gradient(45deg, ${theme.palette.background.default} 10px, transparent 10px), 
      linear-gradient(135deg, ${theme.palette.background.default} 10px, transparent 10px),
      linear-gradient(45deg, #cccccc 11px, transparent 12px),
      linear-gradient(135deg, #cccccc 11px, transparent 12px),
      linear-gradient(45deg, ${theme.palette.background.default} 10px, transparent 10px),
      linear-gradient(135deg, ${theme.palette.background.default} 10px, transparent 10px)`,
      backgroundRepeat: 'repeat',
      backgroundSize: HEADER_OVERVIEW_HEIGHT,
    },
    scaleBarRefName: {
      position: 'absolute',
      fontWeight: 'bold',
      lineHeight: 'normal',
      pointerEvents: 'none',
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

// spacer between regions ~ 2px
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
      width,
      bpPerPx,
      dynamicBlocks: visibleRegions,
      displayedRegions,
    } = model

    overview.setVolatileWidth(width)
    overview.showAllRegions()

    // @ts-ignore
    const polygonColor = theme.palette.tertiary
      ? // prettier-ignore
        // @ts-ignore
        theme.palette.tertiary.light
      : theme.palette.primary.light
    return (
      <svg
        height={HEADER_BAR_HEIGHT}
        width="100%"
        className={classes.overviewSvg}
      >
        {visibleRegions.map((region, idx) => {
          const seqIndex = displayedRegions.findIndex(
            seq => seq.refName === region.refName,
          ) // need a unique identifier here
          if (seqIndex === -1) {
            return null
          }
          let startPx = region.offsetPx - offsetPx
          let endPx = startPx + (region.end - region.start) / bpPerPx
          if (region.reversed) {
            ;[startPx, endPx] = [endPx, startPx]
          }
          const topRight = overview.bpToPx({
            // need a unique identifier here
            refName: region.refName,
            coord: region.end,
          })
          const topLeft = overview.bpToPx({
            refName: region.refName,
            coord: region.start,
          })
          return (
            <polygon
              key={`${region.key}-${idx}`}
              points={[
                [startPx, HEADER_BAR_HEIGHT],
                [endPx, HEADER_BAR_HEIGHT],
                [topRight, 0],
                [topLeft, 0],
              ].toString()}
              fill={fade(polygonColor, 0.3)}
              stroke={fade(polygonColor, 0.8)}
            />
          )
        })}
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
  console.log('visible regions', visibleRegions)
  console.log('displayedRegions', displayedRegions.toJSON())
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
        const parentRegion = model.parentRegion(seq.assemblyName, seq.refName)
        const parentRegionLength = parentRegion
          ? parentRegion.end - parentRegion.start
          : 0 // check for when region is smaller than parent region
        const numLabels = Math.floor(regionLength / gridPitch.majorPitch)
        const labels = []
        for (let index = 0; index < numLabels; index++) {
          seq.reversed
            ? labels.unshift(index * gridPitch.majorPitch + seq.start)
            : labels.push((index + 1) * gridPitch.majorPitch + seq.start)
        }
        return (
          // each displayedRegion
          <Paper
            key={JSON.stringify(seq)}
            style={{
              minWidth: regionLength / scale,
              marginRight:
                idx === displayedRegions.length - 1
                  ? undefined
                  : wholeSeqSpacer,
              borderColor: refNameColor,
            }}
            className={clsx(
              classes.scaleBarContig,
              seq.reversed
                ? classes.scaleBarContigReverse
                : classes.scaleBarContigForward,
            )}
            variant="outlined"
          >
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
                seq.refName === r.refName // need a unique identifier here
              ) {
                const leftStyle = r.reversed
                  ? (seq.end - r.end) / scale - 1
                  : r.start / scale - 1
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
            {/* the number labels */}
            {labels.map((label, labelIdx) => (
              <div
                key={label}
                className={classes.scaleBarLabel}
                style={{
                  left: ((labelIdx + 0.96) * gridPitch.majorPitch) / scale,
                  pointerEvents: 'none',
                  color: refNameColor,
                }}
              >
                {label.toLocaleString('en-US')}
              </div>
            ))}
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
