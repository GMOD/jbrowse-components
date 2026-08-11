import { lazy } from 'react'

import { ErrorBanner, ResizeHandle, ViewLoadingScreen } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import RenderCanvas from '@jbrowse/render-core/RenderCanvas'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { ColorByLegend, DiagonalizeLoadingScreen } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { createDotplotRenderer } from '../../DotplotDisplay/DotplotRenderer.ts'
import { HorizontalAxis, VerticalAxis } from './Axes.tsx'
import DisplayStatusOverlays from './DisplayStatusOverlays.tsx'
import DotplotTooltips from './DotplotTooltips.tsx'
import Header from './Header.tsx'
import MouseInteractionLayer from './MouseInteractionLayer.tsx'
import SelectionContextMenu from './SelectionContextMenu.tsx'
import { useDotplotInteraction } from './useDotplotInteraction.ts'

import type { DotplotViewModel } from '../model.ts'

// lazies. The form pulls in the whole synteny-core quick-start stack
// (ImportFormModes, useQuickStartState, the track selectors), none of which a
// dotplot that opens straight onto a plot ever renders.
const ImportForm = lazy(() => import('./ImportForm/index.tsx'))

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  container: {
    display: 'grid',
    padding: 5,
    position: 'relative',
  },
  overlay: {
    pointerEvents: 'none',
    overflow: 'hidden',
    position: 'relative',
    gridRow: '1/2',
    gridColumn: '2/2',
    zIndex: 100,
  },
  // Out of flow, so this layer's remaining children — the error banners — are
  // laid out from the top of the plot rect and stack there, over the dots.
  // In flow the canvas is an inline replaced element the banners came *after*,
  // which grew the grid row by the banner's height: the horizontal axis slid
  // down and left a gap under the plot, and the on-screen result stopped
  // matching the top strip SVG export draws from the same state.
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  content: {
    position: 'relative',
    gridColumn: '2/2',
    gridRow: '1/2',
  },
  // `overlay` is pointer-events:none so the canvas stacked over the interaction
  // layer doesn't swallow the drag, and pointer-events inherits — so anything
  // in there with a BUTTON has to opt back in. The status overlays manage their
  // own (LoadingOverlay re-enables its chip, ProgressChip stays inert);
  // ErrorBanner doesn't, and its Retry is the only way out of a failed init.
  interactive: {
    pointerEvents: 'auto',
  },
}))

const DotplotCanvas = observer(function DotplotCanvas({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, viewHeight } = model
  const { classes } = useStyles()
  const handle = useRenderingBackend(createDotplotRenderer, model)
  return (
    <>
      <RenderCanvas
        handle={handle}
        drawn={model.settled}
        data-testid="dotplot_webgl_canvas"
        className={classes.canvas}
        style={{
          width: viewWidth,
          height: viewHeight,
        }}
      />
      {/* `onReset` is not optional in practice here, though the prop is. This
        is a drop-to-primitive consumer: the canvas stays mounted through the
        error (ADR-025), so nothing unmounts it to force a re-init the way
        DisplayChrome's `renderError` phase does. `useRenderingBackend`'s
        auto-recovery gives a context loss two attempts on a backoff and then
        stops "leaving the manual Retry button" — so without this the display
        is stranded until a page reload. `retry()` bumps `canvasKey`, which is
        what `RenderCanvas` turns into a fresh element. Synteny's level banner
        has always passed it; this one was the odd one out. */}
      {handle.error ? (
        <div className={classes.interactive}>
          <ErrorBanner error={handle.error} onReset={handle.retry} />
        </div>
      ) : null}
    </>
  )
})

const DotplotViewInternal = observer(function DotplotViewInternal({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const interaction = useDotplotInteraction(model)
  return (
    <div>
      <Header model={model} interaction={interaction} />
      <div className={classes.root}>
        {model.showColorLegend ? (
          <ColorByLegend
            colorBy={model.uniformColorBy}
            trackChips={model.colorLegendChips}
            pointBased
            alpha={model.alpha}
            attributeRanges={model.attributeRanges}
            onClose={() => {
              model.setShowColorLegend(false)
            }}
          />
        ) : null}
        <div className={classes.container}>
          <VerticalAxis model={model} />
          <HorizontalAxis model={model} />
          <div className={classes.content} {...interaction.containerProps}>
            <DotplotTooltips model={model} interaction={interaction} />
            <MouseInteractionLayer model={model} interaction={interaction} />
          </div>
          <div className={classes.overlay}>
            <DotplotCanvas model={model} />
            <DisplayStatusOverlays model={model} />
          </div>
          <SelectionContextMenu model={model} interaction={interaction} />
        </div>
        <ResizeHandle bar onDrag={n => model.setHeight(model.height + n)} />
      </div>
    </div>
  )
})

const DotplotView = observer(function DotplotView({
  model,
}: {
  model: DotplotViewModel
}) {
  const {
    showLoading,
    awaitingAutoDiagonalize,
    showImportForm,
    loadingMessage,
    loadingProgress,
  } = model
  if (awaitingAutoDiagonalize) {
    return (
      <DiagonalizeLoadingScreen
        status={model.diagonalizeStatus}
        onCancel={() => {
          model.cancelAutoDiagonalize()
        }}
      />
    )
  } else if (showLoading) {
    return (
      <ViewLoadingScreen message={loadingMessage} fraction={loadingProgress} />
    )
  } else if (showImportForm) {
    return <ImportForm model={model} />
  } else {
    return <DotplotViewInternal model={model} />
  }
})

export default DotplotView
