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

const wholeSeqSpacer = 2
const Polygon = observer(
  ({
    model,
    overview,
    scale,
  }: {
    model: LGV
    overview: Instance<Base1DViewModel>
    scale: number
  }) => {
    const theme = useTheme()
    const classes = useStyles()
    const {
      offsetPx,
      width,
      bpPerPx,
      dynamicBlocks: visibleRegions,
      displayedParentRegions,
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
          const seqIndex = displayedParentRegions.findIndex(
            seq => seq.refName === region.refName,
          )
          if (seqIndex === -1) {
            return null
          }
          let startPx = region.offsetPx - offsetPx
          let endPx = startPx + (region.end - region.start) / bpPerPx
          if (region.reversed) {
            ;[startPx, endPx] = [endPx, startPx]
          }
          // let totalWidth = 0
          // for (let i = 0; i < seqIndex; i++) {
          //   const seq = displayedParentRegions[i]
          //   const regionLength = seq.end - seq.start
          //   totalWidth += regionLength / scale + wholeSeqSpacer
          // }
          // const parentStart = displayedParentRegions[seqIndex].start

          const topRight = overview.bpToPx({
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

  const { displayedParentRegions, dynamicBlocks: visibleRegions } = model
  const { assemblyManager } = getSession(model)

  const gridPitch = chooseGridPitch(scale, 120, 15)

  return (
    <div className={classes.scaleBar}>
      {displayedParentRegions.map((seq, idx) => {
        const assembly = assemblyManager.get(seq.assemblyName)
        let refNameColor: string | undefined
        if (assembly) {
          refNameColor = assembly.getRefNameColor(seq.refName)
        }
        const regionLength = seq.end - seq.start
        const numLabels = Math.floor(regionLength / gridPitch.majorPitch)
        const labels = []
        for (let index = 0; index < numLabels; index++) {
          labels.push((index + 1) * gridPitch.majorPitch)
        }

        return (
          // each whole sequence
          <Paper
            key={seq.refName}
            style={{
              minWidth: regionLength / scale,
              marginRight:
                idx === displayedParentRegions.length - 1
                  ? undefined
                  : wholeSeqSpacer,
              borderColor: refNameColor,
            }}
            className={classes.scaleBarContig}
            variant="outlined"
          >
            {/* name of sequence */}
            <Typography
              style={{ color: refNameColor }}
              className={classes.scaleBarRefName}
            >
              {seq.refName}
            </Typography>
            {/* where the boxes actually get drawn   */}
            {visibleRegions.map((r, visibleRegionIdx) => {
              if (
                seq.assemblyName === r.assemblyName &&
                seq.refName === r.refName
              ) {
                return (
                  <div
                    key={`${r.key}-${visibleRegionIdx}`}
                    className={classes.scaleBarVisibleRegion}
                    style={{
                      width: Math.max((r.end - r.start) / scale, 1),
                      left: r.start / scale - 1,
                      pointerEvents: 'none',
                    }}
                  />
                )
              }
              return null
            })}
            {/* the numbers */}
            {labels.map((label, labelIdx) => (
              <Typography
                key={label}
                className={classes.scaleBarLabel}
                variant="body2"
                style={{
                  left: ((labelIdx + 1) * gridPitch.majorPitch) / scale,
                  pointerEvents: 'none',
                  color: refNameColor,
                }}
              >
                {label.toLocaleString()}
              </Typography>
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
  const { displayedParentRegions, displayedParentRegionsLength, width } = model

  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedParentRegions)),
  })

  const scale =
    displayedParentRegionsLength /
    (width - (displayedParentRegions.length - 1) * wholeSeqSpacer)

  if (!displayedParentRegions.length) {
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
        <Polygon model={model} overview={overview} scale={scale} />
        {children}
      </div>
    </div>
  )
}

export default observer(OverviewScaleBar)
