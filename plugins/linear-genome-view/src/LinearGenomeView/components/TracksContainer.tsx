import { Suspense, lazy, useRef } from 'react'
import type { ReactNode } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import OverviewHighlightBand from './OverviewHighlightBand.tsx'
import RangeSelectOverlay from './RangeSelectOverlay.tsx'
import Rubberband from './Rubberband.tsx'
import Scalebar from './Scalebar.tsx'
import VerticalGuide from './VerticalGuide.tsx'
import { getHighlightColor } from './util.ts'
import { SCALE_BAR_HEIGHT } from '../consts.ts'
import { useRangeSelect } from './useRangeSelect.ts'
import { useSideScroll } from './useSideScroll.ts'

import type { LinearGenomeViewModel } from '../index.ts'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LinearGenomeView-TracksContainerComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel }
    }
    'LinearGenomeView-ScalebarHighlightComponent': {
      args: ReactNode[]
      result: ReactNode[]
      props: { model: LinearGenomeViewModel }
    }
  }
}

const CenterLine = lazy(() => import('./CenterLine.tsx'))
const Highlight = lazy(() => import('./Highlight.tsx'))

const useStyles = makeStyles()({
  tracksContainer: {
    position: 'relative',
    contain: 'layout style',
  },
  scalebarHighlights: {
    position: 'absolute',
    top: 0,
    height: SCALE_BAR_HEIGHT,
    width: '100%',
    // above Rubberband div (825) so bands show over the scalebar,
    // below RubberbandSpan (830) so the selection rect stays on top
    zIndex: 826,
    pointerEvents: 'none',
  },
})

type LGV = LinearGenomeViewModel

const TracksContainer = observer(function TracksContainer({
  children,
  model,
}: {
  children: React.ReactNode
  model: LGV
}) {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const { mouseDown: sideScrollMouseDown, mouseUp } = useSideScroll(model)
  const { showGridlines, showCenterLine } = model
  const ref = useRef<HTMLDivElement>(null)
  // shift-drag range select over the whole tracks area. This is intentionally
  // a separate range-select instance from the one inside <Rubberband> (the
  // scalebar control); don't dedupe them — they cover different regions.
  const range = useRangeSelect(ref, model, true)

  const additional = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    [],
    { model },
  )

  return (
    <div
      ref={ref}
      data-testid="tracksContainer"
      className={classes.tracksContainer}
      onMouseDown={event => {
        sideScrollMouseDown(event)
        range.mouseDown(event)
      }}
      onMouseMove={range.mouseMove}
      onMouseOut={range.mouseOut}
      onMouseUp={mouseUp}
    >
      {showGridlines ? <Gridlines model={model} /> : null}
      <Suspense fallback={null}>
        {showCenterLine ? <CenterLine model={model} /> : null}
      </Suspense>
      <RangeSelectOverlay model={model} range={range} />
      {model.volatileGuides.map((guide, idx) => (
        <VerticalGuide key={idx} model={model} coordX={guide.xPos} />
      ))}
      <Rubberband
        model={model}
        ControlComponent={
          <Scalebar
            model={model}
            style={{
              height: SCALE_BAR_HEIGHT,
              boxSizing: 'border-box',
            }}
          />
        }
      />
      <ScalebarHighlightGroup model={model} />
      <HighlightGroup model={model} />
      {additional}
      {children}
    </div>
  )
})

const HighlightGroup = observer(function HighlightGroup({
  model,
}: {
  model: LGV
}) {
  return model.highlightsVisible && model.highlight.length ? (
    <Suspense fallback={null}>
      {model.highlight.map((highlight, idx) => (
        <Highlight
          key={`${highlight.assemblyName}-${highlight.refName}:${highlight.start}-${highlight.end}-${idx}`}
          model={model}
          highlight={highlight}
        />
      ))}
    </Suspense>
  ) : null
})

const ScalebarHighlightGroup = observer(function ScalebarHighlightGroup({
  model,
}: {
  model: LGV
}) {
  const theme = useTheme()
  const { pluginManager } = getEnv(model)
  const { classes } = useStyles()
  const viewBands = model.highlightsVisible
    ? model.highlight.map((h, idx) => {
        const coords = model.getHighlightCoords(h)
        return coords ? (
          <OverviewHighlightBand
            key={`${h.assemblyName}-${h.refName}:${h.start}-${h.end}-${idx}`}
            coords={coords}
            background={getHighlightColor(h, theme).toRgbString()}
          />
        ) : null
      })
    : []
  const additional = pluginManager.evaluateExtensionPoint(
    'LinearGenomeView-ScalebarHighlightComponent',
    [] as ReactNode[],
    { model },
  )
  return (
    <div className={classes.scalebarHighlights}>
      {viewBands}
      {additional}
    </div>
  )
})

export default TracksContainer
