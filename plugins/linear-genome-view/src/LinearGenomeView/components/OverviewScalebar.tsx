import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { getEnv, getSession } from '@jbrowse/core/util'
import {
  createOverviewLayout,
  getContentBlocksPxSpan,
} from '@jbrowse/core/util/Base1DUtils'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography, alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Cytobands from './Cytobands.tsx'
import OverviewHighlight from './OverviewHighlight.tsx'
import OverviewRubberband from './OverviewRubberband.tsx'
import OverviewScalebarPolygon from './OverviewScalebarPolygon.tsx'
import OverviewScalebarTickLabels from './OverviewScalebarTickLabels.tsx'
import { getCytobands } from './util.ts'
import { HEADER_BAR_HEIGHT, HEADER_OVERVIEW_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LinearGenomeView-OverviewScalebarComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel; overview: ViewLayout }
    }
  }
}

const wholeSeqSpacer = 2

const useStyles = makeStyles()(theme => ({
  scalebar: {
    height: HEADER_OVERVIEW_HEIGHT,
    contain: 'layout style',
  },
  scalebarBorder: {
    border: '1px solid',
  },
  scalebarContig: {
    backgroundColor: theme.palette.background.default,
    position: 'absolute',
    top: 0,
    left: 0,
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
    top: 0,
    fontWeight: 'bold',
    pointerEvents: 'none',
    zIndex: 100,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    maxWidth: 'calc(100% - 6px)',
  },
  scalebarVisibleRegion: {
    position: 'absolute',
    height: HEADER_OVERVIEW_HEIGHT,
    pointerEvents: 'none',
    zIndex: 100,
    border: '1px solid',
    left: 0,
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
  elidedOverviewBlock: {
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
  cytoSvg: {
    width: '100%',
  },
}))

type LGV = LinearGenomeViewModel

const OverviewBox = observer(function OverviewBox({
  scale,
  model,
  block,
  overview,
}: {
  scale: number
  model: LGV
  block: ContentBlock
  overview: ViewLayout
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const { cytobandOffset, showCytobands } = model
  const { reversed, refName, assemblyName } = block
  const { assemblyManager } = getSession(model)
  const assembly = assemblyManager.get(assemblyName)
  const refNameColor = assembly?.getRefNameColor(refName)

  const canDisplayCytobands =
    showCytobands && getCytobands(assembly, block.refName).length

  if (canDisplayCytobands) {
    return (
      <>
        <Typography
          style={{
            color: theme.palette.text.primary,
            transform: `translateX(${block.offsetPx + 3}px)`,
          }}
          className={classes.scalebarRefName}
        >
          {refName}
        </Typography>
        <div
          className={classes.scalebarContig}
          style={{
            transform: `translateX(${block.offsetPx + cytobandOffset}px)`,
            width: block.widthPx,
          }}
        >
          <svg className={classes.cytoSvg}>
            <Cytobands overview={overview} assembly={assembly} block={block} />
          </svg>
        </div>
      </>
    )
  }

  return (
    <div
      className={cx(
        classes.scalebarContig,
        reversed
          ? classes.scalebarContigReverse
          : classes.scalebarContigForward,
        classes.scalebarBorder,
      )}
      style={{
        transform: `translateX(${block.offsetPx + cytobandOffset}px)`,
        width: block.widthPx,
        borderColor: refNameColor,
      }}
    >
      <Typography
        style={{ color: refNameColor, left: 3 }}
        className={classes.scalebarRefName}
      >
        {refName}
      </Typography>
      <OverviewScalebarTickLabels
        model={model}
        overview={overview}
        scale={scale}
        block={block}
      />
    </div>
  )
})

const VisibleRegionBox = observer(function VisibleRegionBox({
  model,
  overview,
  className,
}: {
  model: LGV
  overview: ViewLayout
  className: string
}) {
  const theme = useTheme()
  const { dynamicBlocks, showCytobands, cytobandOffset } = model
  const span = getContentBlocksPxSpan(overview, dynamicBlocks.contentBlocks)
  if (!span) {
    return null
  }

  const color = showCytobands ? '#f00' : theme.palette.tertiary.light
  const transparency = showCytobands ? 0.1 : 0.3

  return (
    <div
      className={className}
      style={{
        width: span.rightPx - span.leftPx,
        transform: `translateX(${span.leftPx + cytobandOffset}px)`,
        background: alpha(color, transparency),
        borderColor: color,
      }}
    />
  )
})

const Scalebar = observer(function Scalebar({
  model,
  scale,
  overview,
}: {
  model: LGV
  overview: ViewLayout
  scale: number
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const overviewVisibleRegions = calculateDynamicBlocks(overview).blocks

  const additional = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-OverviewScalebarComponent',
    [],
    { model, overview },
  )

  return (
    <div className={classes.scalebar}>
      <VisibleRegionBox
        model={model}
        overview={overview}
        className={classes.scalebarVisibleRegion}
      />
      {/* this is the entire scale bar */}
      {overviewVisibleRegions.map((block, idx) => {
        return !(block.type === 'ContentBlock') ? (
          <div
            key={`${JSON.stringify(block)}-${idx}`}
            className={cx(classes.scalebarContig, classes.elidedOverviewBlock)}
            style={{
              width: block.widthPx,
              transform: `translateX(${block.offsetPx}px)`,
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

const OverviewScalebar = observer(function OverviewScalebar({
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

  const overviewWidth = width - cytobandOffset
  const overview = useMemo(
    () =>
      createOverviewLayout({
        displayedRegions,
        width: overviewWidth,
        minimumBlockWidth,
      }),
    [displayedRegions, minimumBlockWidth, overviewWidth],
  )

  const scale =
    totalBp / (overviewWidth - (displayedRegions.length - 1) * wholeSeqSpacer)

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
