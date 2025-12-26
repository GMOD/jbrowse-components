import { LoadingEllipses, ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { HorizontalAxis, VerticalAxis } from './Axes'
import DotplotTooltips from './DotplotTooltips'
import Header from './Header'
import ImportForm from './ImportForm'
import MouseInteractionLayer from './MouseInteractionLayer'
import SelectionContextMenu from './SelectionContextMenu'
import { useCtrlKeyTracking } from './hooks/useCtrlKeyTracking'
import { useCursorMode } from './hooks/useCursorMode'
import { useMouseCoordinates } from './hooks/useMouseCoordinates'
import { useMouseMoveHandler } from './hooks/useMouseMoveHandler'
import { useMouseUpHandler } from './hooks/useMouseUpHandler'
import { useWheelHandler } from './hooks/useWheelHandler'

import type { DotplotViewModel } from '../model'

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
    display: 'flex',
    width: '100%',
    gridRow: '1/2',
    gridColumn: '2/2',
    zIndex: 100, // needs to be below controls
    '& path': {
      cursor: 'crosshair',
      fill: 'none',
    },
  },

  content: {
    position: 'relative',
    gridColumn: '2/2',
    gridRow: '1/2',
  },

  resizeHandle: {
    height: 4,
    background: '#ccc',
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
}))

const RenderedComponent = observer(function RenderedComponent({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.overlay}>
      {model.tracks.map(track => {
        const [display] = track.displays
        const { RenderingComponent } = display
        return RenderingComponent ? (
          <RenderingComponent
            key={track.configuration.trackId}
            model={display}
          />
        ) : null
      })}
    </div>
  )
})

const DotplotViewInternal = observer(function DotplotViewInternal({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const { hview, vview, wheelMode, cursorMode } = model

  // Mouse coordinate tracking
  const {
    mousecurrClient,
    mousedownClient,
    mouseupClient,
    mouseOvered,
    setMouseCurrClient,
    setMouseDownClient,
    setMouseUpClient,
    setMouseOvered,
    ref,
    root,
    rootRect,
    mousedown,
    mousecurr,
    mouseup,
    mouserect,
    mouserectClient,
    xdistance,
    ydistance,
  } = useMouseCoordinates()

  // Cursor mode and validation
  const {
    ctrlKeyDown,
    validPan,
    validSelect,
    setCtrlKeyWasUsed,
    setCtrlKeyDown,
  } = useCursorMode(cursorMode)

  // Event handlers
  useWheelHandler(ref, wheelMode, hview, vview, mousecurr, rootRect.height)
  useMouseMoveHandler(
    mousecurrClient,
    mousedownClient,
    mouseupClient,
    validPan,
    hview,
    vview,
    setMouseCurrClient,
  )
  useCtrlKeyTracking(setCtrlKeyDown)
  useMouseUpHandler(
    mousedown,
    mouseup,
    xdistance,
    ydistance,
    validSelect,
    setMouseUpClient,
    setMouseDownClient,
  )

  return (
    <div>
      <Header
        model={model}
        selection={
          !validSelect || !(mousedown && mouserect)
            ? undefined
            : {
                width: Math.abs(xdistance),
                height: Math.abs(ydistance),
              }
        }
      />
      <div
        ref={root}
        className={classes.root}
        onMouseLeave={() => {
          setMouseOvered(false)
        }}
        onMouseEnter={() => {
          setMouseOvered(true)
        }}
      >
        <div className={classes.container}>
          <VerticalAxis model={model} />
          <HorizontalAxis model={model} />
          <div ref={ref} className={classes.content}>
            <DotplotTooltips
              model={model}
              mouseOvered={mouseOvered}
              validSelect={validSelect}
              mouserect={mouserect}
              mouserectClient={mouserectClient}
              xdistance={xdistance}
              mousedown={mousedown}
              mousedownClient={mousedownClient}
              ydistance={ydistance}
            />
            <MouseInteractionLayer
              model={model}
              ctrlKeyDown={ctrlKeyDown}
              cursorMode={cursorMode}
              validSelect={validSelect}
              mousedown={mousedown}
              mouserect={mouserect}
              xdistance={xdistance}
              ydistance={ydistance}
              setMouseDownClient={setMouseDownClient}
              setMouseCurrClient={setMouseCurrClient}
              setCtrlKeyWasUsed={setCtrlKeyWasUsed}
            />
            <div className={classes.spacer} />
          </div>
          <RenderedComponent model={model} />
          <SelectionContextMenu
            model={model}
            mouseup={mouseup}
            mouseupClient={mouseupClient}
            mousedown={mousedown}
            setMouseUpClient={setMouseUpClient}
            setMouseDownClient={setMouseDownClient}
            setMouseOvered={setMouseOvered}
          />
        </div>
        <ResizeHandle
          onDrag={n => model.setHeight(model.height + n)}
          className={classes.resizeHandle}
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
