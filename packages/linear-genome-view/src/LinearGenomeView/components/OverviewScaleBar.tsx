import { Region } from '@gmod/jbrowse-core/util/types'
import { getSession, isAbortException } from '@gmod/jbrowse-core/util'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import LinearProgress from '@material-ui/core/LinearProgress'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { Typography } from '@material-ui/core'
import {
  LinearGenomeViewStateModel,
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import { chooseGridPitch } from '../util'

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

type LGV = Instance<LinearGenomeViewStateModel>
function OverviewScaleBar({
  model,
  children,
}: {
  model: LGV
  children: React.ReactNode
}) {
  const [assemblyRegions, setAssemblyRegions] = useState<
    Map<string, Region[]>
  >()
  const [error, setError] = useState('')
  const classes = useStyles()
  const theme = useTheme()

  const {
    assemblyNames,
    displayedRegions,
    dynamicBlocks: visibleRegions,
    width,
    offsetPx,
    bpPerPx,
  } = model

  const {
    getRegionsForAssemblyName,
  }: {
    getRegionsForAssemblyName: (
      assemblyName: string,
      { signal }: { signal?: AbortSignal },
    ) => Promise<Region[]>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = getSession(model) as any
  useEffect(() => {
    let aborter: AbortController
    let mounted = true
    async function fetchRegions() {
      if (assemblyNames.length) {
        const fetchedAssemblyRegions = new Map() as Map<string, Region[]>
        for (const assemblyName of assemblyNames) {
          try {
            aborter = new AbortController()
            // eslint-disable-next-line no-await-in-loop
            const fetchedRegions = await getRegionsForAssemblyName(
              assemblyName,
              { signal: aborter.signal },
            )
            fetchedAssemblyRegions.set(assemblyName, fetchedRegions)
          } catch (e) {
            if (!isAbortException(e) && mounted) {
              setError(String(e))
            }
          }
        }
        if (mounted) {
          setAssemblyRegions(fetchedAssemblyRegions)
        }
      }
    }
    fetchRegions()

    return () => {
      mounted = false
      aborter && aborter.abort()
    }
  }, [assemblyNames, getRegionsForAssemblyName])

  const wholeRefSeqs = [] as Region[]
  let totalLength = 0
  displayedRegions.forEach(({ refName, assemblyName }) => {
    const r = assemblyRegions && assemblyRegions.get(assemblyName)
    if (r) {
      const wholeSequence = r.find(sequence => sequence.refName === refName)
      const alreadyExists = wholeRefSeqs.find(
        sequence => sequence.refName === refName,
      )
      if (wholeSequence && !alreadyExists) {
        wholeRefSeqs.push(wholeSequence)
        totalLength += wholeSequence.end - wholeSequence.start
      }
    }
  })

  const wholeSeqSpacer = 2
  const scale =
    totalLength / (width - (wholeRefSeqs.length - 1) * wholeSeqSpacer)
  const gridPitch = chooseGridPitch(scale, 120, 15)

  // @ts-ignore
  const polygonColor = theme.palette.tertiary
    ? // prettier-ignore
      // @ts-ignore
      theme.palette.tertiary.light
    : theme.palette.primary.light

  if (error) {
    return (
      <>
        <div className={classes.scaleBar}>
          <Typography color="error">{error}</Typography>
        </div>
        <div>{children}</div>
      </>
    )
  }

  if (!wholeRefSeqs.length) {
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
    <>
      <div className={classes.scaleBar}>
        {wholeRefSeqs.map((seq, idx) => {
          const regionLength = seq.end - seq.start
          const numLabels = Math.floor(regionLength / gridPitch.majorPitch)
          const labels = []
          for (let index = 0; index < numLabels; index++) {
            labels.push((index + 1) * gridPitch.majorPitch)
          }

          return (
            <Paper
              key={seq.refName}
              style={{
                minWidth: regionLength / scale,
                marginRight:
                  idx === wholeRefSeqs.length - 1 ? undefined : wholeSeqSpacer,
              }}
              className={classes.scaleBarContig}
              variant="outlined"
            >
              <Typography className={classes.scaleBarRefName}>
                {seq.refName}
              </Typography>
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
                      }}
                    />
                  )
                }
                return null
              })}
              {labels.map((label, labelIdx) => (
                <div
                  key={label}
                  className={classes.scaleBarLabel}
                  style={{
                    left: ((labelIdx + 1) * gridPitch.majorPitch) / scale,
                  }}
                >
                  {label.toLocaleString()}
                </div>
              ))}
            </Paper>
          )
        })}
      </div>
      <div className={classes.overview}>
        <svg
          height={HEADER_BAR_HEIGHT}
          width="100%"
          className={classes.overviewSvg}
        >
          {visibleRegions.map((region, idx) => {
            const seqIndex = wholeRefSeqs.findIndex(
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
              const seq = wholeRefSeqs[i]
              const regionLength = seq.end - seq.start
              totalWidth += regionLength / scale + wholeSeqSpacer
            }
            const topLeft =
              totalWidth +
              (region.start - wholeRefSeqs[seqIndex].start) / scale +
              1
            let topRight =
              totalWidth +
              (region.end - wholeRefSeqs[seqIndex].start) / scale +
              1
            if (topRight - topLeft < 1) {
              topRight = topLeft + 1
            }
            return (
              <polygon
                key={`${region.key}-${idx}`}
                points={[
                  // @ts-ignore
                  [startPx, HEADER_BAR_HEIGHT],
                  // @ts-ignore
                  [endPx, HEADER_BAR_HEIGHT],
                  // @ts-ignore
                  [topRight, 0],
                  // @ts-ignore
                  [topLeft, 0],
                ]}
                fill={fade(polygonColor, 0.3)}
                stroke={fade(polygonColor, 0.8)}
              />
            )
          })}
        </svg>
        {children}
      </div>
    </>
  )
}

export default observer(OverviewScaleBar)
