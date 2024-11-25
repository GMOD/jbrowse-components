import React, { useMemo } from 'react'

// core
import { getEnv, getSession } from '@jbrowse/core/util'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { Typography, useTheme, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import Cytobands from './Cytobands'
import OverviewHighlight from './OverviewHighlight'
import OverviewRubberband from './OverviewRubberband'
import OverviewScalebarPolygon from './OverviewScalebarPolygon'
import OverviewScalebarTickLabels from './OverviewScalebarTickLabels'
import { getCytobands } from './util'
import { HEADER_BAR_HEIGHT, HEADER_OVERVIEW_HEIGHT } from '../consts'
import type { LinearGenomeViewModel } from '..'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

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
    pointerEvents: 'none',
    width: '100%',
    position: 'absolute',
  },
}))

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
  const { reversed, refName, assemblyName } = block
  const { assemblyManager } = getSession(model)
  const assembly = assemblyManager.get(assemblyName)
  const refNameColor = assembly?.getRefNameColor(refName)

  const canDisplayCytobands =
    showCytobands && getCytobands(assembly, block.refName).length

  return (
    <div>
      {/* name of sequence */}
      <Typography
        style={{
          left: block.offsetPx + 3,
          color: canDisplayCytobands
            ? theme.palette.text.primary
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
        {canDisplayCytobands ? (
          <svg style={{ width: '100%' }}>
            <Cytobands overview={overview} assembly={assembly} block={block} />
          </svg>
        ) : (
          <OverviewScalebarTickLabels
            model={model}
            overview={overview}
            scale={scale}
            block={block}
          />
        )}
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
  const { pluginManager } = getEnv(model)
  const visibleRegions = dynamicBlocks.contentBlocks
  const overviewVisibleRegions = overview.dynamicBlocks
  const scalebarColor = theme.palette.tertiary.light
  // catches possible null from at's below
  if (!visibleRegions.length) {
    return null
  }

  const first = visibleRegions.at(0)!
  const last = visibleRegions.at(-1)!

  const firstOverviewPx =
    overview.bpToPx({
      ...first,
      coord: first.reversed ? first.end : first.start,
    }) || 0

  const lastOverviewPx =
    overview.bpToPx({
      ...last,
      coord: last.reversed ? last.start : last.end,
    }) || 0

  const color = showCytobands ? '#f00' : scalebarColor
  const transparency = showCytobands ? 0.1 : 0.3

  const additional = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    undefined,
    { model, overview },
  ) as React.ReactNode

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
        return !(block.type === 'ContentBlock') ? (
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
      <OverviewHighlight model={model} overview={overview} />
      {additional}
    </div>
  )
})

const OverviewScalebar = observer(function ({
  model,
  children,
}: {
  model: LGV
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const {
    minimumBlockWidth,
    totalBp,
    width,
    cytobandOffset,
    displayedRegions,
  } = model

  const modWidth = width - cytobandOffset
  const str = JSON.stringify(displayedRegions)
  const overview = useMemo(() => {
    const overview = Base1DView.create({
      displayedRegions: JSON.parse(str),
      interRegionPaddingWidth: 0,
      minimumBlockWidth,
    })

    overview.setVolatileWidth(modWidth)
    overview.showAllRegions()
    return overview
  }, [str, minimumBlockWidth, modWidth])

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
          <OverviewScalebarPolygon model={model} overview={overview} />
        </svg>
        {children}
      </div>
    </div>
  )
})

export default OverviewScalebar
