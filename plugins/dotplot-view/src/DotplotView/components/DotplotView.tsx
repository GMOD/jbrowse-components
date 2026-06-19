import { ErrorBanner, LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { useRenderingBackend } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { HorizontalAxis, VerticalAxis } from './Axes.tsx'
import DisplayStatusOverlays from './DisplayStatusOverlays.tsx'
import DotplotTooltips from './DotplotTooltips.tsx'
import Header from './Header.tsx'
import ImportForm from './ImportForm/index.tsx'
import MouseInteractionLayer from './MouseInteractionLayer.tsx'
import SelectionContextMenu from './SelectionContextMenu.tsx'
import { useDotplotInteraction } from './useDotplotInteraction.ts'
import { createDotplotRenderer } from '../../DotplotDisplay/DotplotRenderer.ts'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  spacer: {
    gridColumn: '1/2',
    gridRow: '2/2',
  },
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
  content: {
    position: 'relative',
    gridColumn: '2/2',
    gridRow: '1/2',
  },
}))

const DotplotCanvas = observer(function DotplotCanvas({
  model,
}: {
  model: DotplotViewModel
}) {
  const { viewWidth, viewHeight } = model
  const { canvasRef, error: gpuError } = useRenderingBackend(
    createDotplotRenderer,
    model,
  )
  return (
    <>
      <canvas
        ref={canvasRef}
        data-testid={
          model.canvasDrawn
            ? 'dotplot_webgl_canvas_done'
            : 'dotplot_webgl_canvas'
        }
        style={{
          width: viewWidth,
          height: viewHeight,
        }}
      />
      {gpuError ? <ErrorBanner error={gpuError} /> : null}
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
      <Header model={model} selection={interaction.selection} />
      <div
        className={classes.root}
        onMouseLeave={() => {
          interaction.setMouseOvered(false)
        }}
        onMouseEnter={() => {
          interaction.setMouseOvered(true)
        }}
      >
        <div className={classes.container}>
          <VerticalAxis model={model} />
          <HorizontalAxis model={model} />
          <div ref={interaction.refCallback} className={classes.content}>
            <DotplotTooltips model={model} interaction={interaction} />
            <MouseInteractionLayer model={model} interaction={interaction} />
            <div className={classes.spacer} />
          </div>
          <div className={classes.overlay}>
            <DotplotCanvas model={model} />
            <DisplayStatusOverlays model={model} />
          </div>
          <SelectionContextMenu model={model} interaction={interaction} />
        </div>
        <ResizeHandle
          bar
          onDrag={n => model.setHeight(model.height + n)}
        />
      </div>
    </div>
  )
})

const DotplotView = observer(function DotplotView({
  model,
}: {
  model: DotplotViewModel
}) {
  const { initialized, showLoading, error, loadingMessage } = model
  if (showLoading) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (!initialized || error) {
    return <ImportForm model={model} />
  } else {
    return <DotplotViewInternal model={model} />
  }
})

export default DotplotView
