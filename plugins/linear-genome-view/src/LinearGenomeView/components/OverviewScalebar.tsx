import React from 'react'
import { Typography, useTheme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// core
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { getSession, getTickDisplayStr } from '@jbrowse/core/util'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'

// locals
import {
  LinearGenomeViewModel,
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import { chooseGridPitch } from '../util'
import OverviewRubberband from './OverviewRubberband'
import Cytobands from './Cytobands'
import { getCytobands } from './util'

const wholeSeqSpacer = 2

const useStyles = makeStyles()(theme => ({
  scalebar: {
    height: HEADER_OVERVIEW_HEIGHT,
  },
  scalebarBorder: {
    border: '1px solid',
  },
  scalebarContig: {
    backgroundColor: theme.palette.background.default,
    position: 'absolute',
    top: 0,
    height: HEADER_OVERVIEW_HEIGHT,
    overflow: 'hidden',
  },
  scalebarContigForward: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 9'%3E%3Cpath d='M-.1 0L6 4.5L-.1 9' fill='none' stroke='${theme.palette.divider}'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
  },
  scalebarContigReverse: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 9'%3E%3Cpath d='M6 0L0 4.5L6 9' fill='none' stroke='${theme.palette.divider}'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
  },

  scalebarRefName: {
    position: 'absolute',
    fontWeight: 'bold',
    pointerEvents: 'none',
    zIndex: 100,
  },
  scalebarLabel: {
    height: HEADER_OVERVIEW_HEIGHT,
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  scalebarVisibleRegion: {
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

const Polygon = observer(function ({
  model,
  overview,
  useOffset = true,
}: {
  model: LGV
  overview: Base1DViewModel
  useOffset?: boolean
}) {
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
})

type LGV = LinearGenomeViewModel

const OverviewBox = observer(function ({
  scale,
  model,
  block,
  overview,
}: {
  scale: number
  model: LGV
  block: ContentBlock
  overview: Base1DViewModel
}) {
  const { classes, cx } = useStyles()
  const theme = useTheme()
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
          color: canDisplayCytobands
            ? theme.palette.primary.contrastText
            : refNameColor,
        }}
        className={classes.scalebarRefName}
      >
        {refName}
      </Typography>
      <div
        className={cx(
          classes.scalebarContig,
          canDisplayCytobands
            ? undefined
            : reversed
            ? classes.scalebarContigReverse
            : classes.scalebarContigForward,
          !canDisplayCytobands ? classes.scalebarBorder : undefined,
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
                className={classes.scalebarLabel}
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
            <Cytobands overview={overview} assembly={assembly} block={block} />
          </svg>
        ) : null}
      </div>
    </div>
  )
})

const Scalebar = observer(function ({
  model,
  scale,
  overview,
}: {
  model: LGV
  overview: Base1DViewModel
  scale: number
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const { dynamicBlocks, showCytobands, cytobandOffset } = model
  const visibleRegions = dynamicBlocks.contentBlocks
  const overviewVisibleRegions = overview.dynamicBlocks

  const { tertiary, primary } = theme.palette
  const scalebarColor = tertiary ? tertiary.light : primary.light

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

  const color = showCytobands ? '#f00' : scalebarColor
  const transparency = showCytobands ? 0.1 : 0.3

  return (
    <div className={classes.scalebar}>
      <div
        className={classes.scalebarVisibleRegion}
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
            className={classes.scalebarContig}
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
})

export default observer(function OverviewScalebar({
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
      <OverviewRubberband
        model={model}
        overview={overview}
        ControlComponent={
          <Scalebar model={model} overview={overview} scale={scale} />
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
})

export { Polygon }

export { default as Cytobands } from './Cytobands'
