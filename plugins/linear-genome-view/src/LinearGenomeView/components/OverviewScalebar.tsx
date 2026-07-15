import type { ReactNode } from 'react'

import { getEnv, getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography, alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Cytobands from './Cytobands.tsx'
import OverviewHighlight from './OverviewHighlight.tsx'
import OverviewRubberband from './OverviewRubberband.tsx'
import OverviewScalebarPolygon from './OverviewScalebarPolygon.tsx'
import OverviewScalebarTickLabels from './OverviewScalebarTickLabels.tsx'
import { elidedBlockStyles, getCytobands } from './util.ts'
import { HEADER_BAR_HEIGHT, HEADER_OVERVIEW_HEIGHT } from '../consts.ts'
import {
  REF_NAME_LABEL_FONT_SIZE,
  getBlockRefName,
  showRefNameLabels,
} from '../util.ts'

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
  // cytoband strip keeps a fixed light backdrop in both light/dark mode: the
  // Giemsa greyscale runs to pure black (gpos100/gvar), which would vanish on
  // the dark theme's background.default. UCSC/IGV likewise draw the ideogram on
  // a fixed white strip.
  scalebarContigCytoband: {
    backgroundColor: theme.palette.common.white,
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
    fontSize: REF_NAME_LABEL_FONT_SIZE,
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
    ...elidedBlockStyles,
  },
  cytoSvg: {
    width: '100%',
  },
}))

type LGV = LinearGenomeViewModel

const OverviewBox = observer(function OverviewBox({
  model,
  block,
  showRefName,
}: {
  model: LGV
  block: ContentBlock
  showRefName: boolean
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const {
    cytobandOffset,
    effectiveShowCytobands,
    overviewLayout: overview,
  } = model
  const { reversed, refName, assemblyName } = block
  const { assemblyManager } = getSession(model)
  const assembly = assemblyManager.get(assemblyName)
  const refNameColor = assembly?.getRefNameColor(refName)

  const cytobands = effectiveShowCytobands
    ? getCytobands(assembly, refName)
    : []
  const canDisplayCytobands = cytobands.length > 0

  if (canDisplayCytobands) {
    return (
      <>
        {showRefName ? (
          <Typography
            style={{
              // fixed dark: this label overlays the always-white cytoband strip,
              // so text.primary (white in dark mode) would be invisible
              color: theme.palette.common.black,
              transform: `translateX(${block.offsetPx + 3}px)`,
            }}
            className={classes.scalebarRefName}
          >
            {refName}
          </Typography>
        ) : null}
        <div
          className={cx(classes.scalebarContig, classes.scalebarContigCytoband)}
          style={{
            transform: `translateX(${block.offsetPx + cytobandOffset}px)`,
            width: block.widthPx,
          }}
        >
          <svg className={classes.cytoSvg}>
            <Cytobands
              overview={overview}
              cytobands={cytobands}
              block={block}
            />
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
      {showRefName ? (
        <Typography
          style={{ color: refNameColor, left: 3 }}
          className={classes.scalebarRefName}
        >
          {refName}
        </Typography>
      ) : null}
      <OverviewScalebarTickLabels
        model={model}
        block={block}
        refNameColor={refNameColor}
        showRefName={showRefName}
      />
    </div>
  )
})

const VisibleRegionBox = observer(function VisibleRegionBox({
  model,
  className,
}: {
  model: LGV
  className: string
}) {
  const theme = useTheme()
  const {
    effectiveShowCytobands,
    cytobandOffset,
    overviewContentBlocksPxSpan: span,
  } = model
  if (!span) {
    return null
  }

  const { color, opacity } = effectiveShowCytobands
    ? { color: '#f00', opacity: 0.1 }
    : { color: theme.palette.tertiary.light, opacity: 0.3 }

  return (
    <div
      className={className}
      style={{
        width: span.rightPx - span.leftPx,
        transform: `translateX(${span.leftPx + cytobandOffset}px)`,
        background: alpha(color, opacity),
        borderColor: color,
      }}
    />
  )
})

const OverviewScalebarContent = observer(function OverviewScalebarContent({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const { overviewLayout: overview, overviewBlocks } = model

  const additional = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint LinearGenomeView-OverviewScalebarComponent | sync | Add a component to the overview scalebar */
    'LinearGenomeView-OverviewScalebarComponent',
    [],
    { model, overview },
  )

  const showRefName = showRefNameLabels(overviewBlocks, getBlockRefName)

  return (
    <div className={classes.scalebar}>
      <VisibleRegionBox
        model={model}
        className={classes.scalebarVisibleRegion}
      />
      {overviewBlocks.map((block, i) =>
        block.type === 'ContentBlock' ? (
          <OverviewBox
            block={block}
            model={model}
            showRefName={showRefName[i]!}
            key={block.key}
          />
        ) : block.type === 'ElidedBlock' ? (
          <div
            key={block.key}
            className={cx(classes.scalebarContig, classes.elidedOverviewBlock)}
            style={{
              width: block.widthPx,
              transform: `translateX(${block.offsetPx}px)`,
            }}
          />
        ) : null,
      )}
      <OverviewHighlight model={model} />
      {additional}
    </div>
  )
})

const OverviewScalebar = observer(function OverviewScalebar({
  model,
  children,
}: {
  model: LGV
  children: ReactNode
}) {
  const { classes } = useStyles()
  const overview = model.overviewLayout

  return (
    <div>
      <OverviewRubberband
        model={model}
        overview={overview}
        ControlComponent={<OverviewScalebarContent model={model} />}
      />
      <div className={classes.overview}>
        <svg height={HEADER_BAR_HEIGHT} className={classes.overviewSvg}>
          <OverviewScalebarPolygon
            model={model}
            overview={overview}
            overviewOffsetPx={model.cytobandOffset}
          />
        </svg>
        {children}
      </div>
    </div>
  )
})

export default OverviewScalebar
