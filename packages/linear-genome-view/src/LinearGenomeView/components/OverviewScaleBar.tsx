import { Region } from '@gmod/jbrowse-core/util/types'
import { Region as MSTRegion } from '@gmod/jbrowse-core/util/types/mst'
import Base1DView from '@gmod/jbrowse-core/util/Base1DViewModel'
import { getSession } from '@gmod/jbrowse-core/util'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import LinearProgress from '@material-ui/core/LinearProgress'
import { withContentRect } from 'react-measure'
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
import OverviewRubberBand from './RubberBand'

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

const Polygon = observer(({ model }: { model: LGV }) => {
  const theme = useTheme()
  const classes = useStyles()
  const {
    offsetPx,
    width,
    bpPerPx,
    dynamicBlocks: visibleRegions,
    displayedParentRegions,
    displayedParentRegionsLength,
  } = model
  const wholeSeqSpacer = 2

  // @ts-ignore
  const polygonColor = theme.palette.tertiary
    ? // prettier-ignore
      // @ts-ignore
      theme.palette.tertiary.light
    : theme.palette.primary.light
  const scale =
    displayedParentRegionsLength /
    (width - (displayedParentRegions.length - 1) * wholeSeqSpacer)
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
        let totalWidth = 0
        for (let i = 0; i < seqIndex; i++) {
          const seq = displayedParentRegions[i]
          const regionLength = seq.end - seq.start
          totalWidth += regionLength / scale + wholeSeqSpacer
        }
        const topLeft =
          totalWidth +
          (region.start - displayedParentRegions[seqIndex].start) / scale +
          1
        let topRight =
          totalWidth +
          (region.end - displayedParentRegions[seqIndex].start) / scale +
          1
        if (topRight - topLeft < 1) {
          topRight = topLeft + 1
        }
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
})

type LGV = Instance<LinearGenomeViewStateModel>

const ScaleBar = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()

  const { displayedRegions, dynamicBlocks: visibleRegions, width } = model
  const { assemblyManager } = getSession(model)

  const displayedParentRegions = [] as Region[]
  let totalLength = 0
  displayedRegions.forEach(({ refName, assemblyName }) => {
    const assembly = assemblyManager.get(assemblyName)
    const r = assembly && (assembly.regions as Instance<typeof MSTRegion>[])
    if (r) {
      const wholeSequence = r.find(sequence => sequence.refName === refName)
      const alreadyExists = displayedParentRegions.find(
        sequence => sequence.refName === refName,
      )
      if (wholeSequence && !alreadyExists) {
        displayedParentRegions.push(wholeSequence)
        totalLength += wholeSequence.end - wholeSequence.start
      }
    }
  })
  const wholeSeqSpacer = 2
  const scale =
    totalLength / (width - (displayedParentRegions.length - 1) * wholeSeqSpacer)
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
              <div
                key={label}
                className={classes.scaleBarLabel}
                style={{
                  left: ((labelIdx + 1) * gridPitch.majorPitch) / scale,
                  pointerEvents: 'none',
                  color: refNameColor,
                }}
              >
                {label.toLocaleString()}
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
  const { displayedParentRegions } = model

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
        ControlComponent={<ScaleBar model={model} />}
      />
      <div className={classes.overview}>
        <Polygon model={model} />
        {children}
      </div>
    </div>
  )
}

export default observer(OverviewScaleBar)
