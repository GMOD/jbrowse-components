import React, { useState, useEffect, useRef } from 'react'
import { LoadingEllipses, Menu, ResizeHandle } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { makeStyles } from 'tss-react/mui'
import normalizeWheel from 'normalize-wheel'

// locals
import { DotplotViewModel } from '../model'
import ImportForm from './ImportForm'
import Header from './Header'
import Grid from './Grid'
import { VerticalAxis, HorizontalAxis } from './Axes'
import { TooltipWhereClicked, TooltipWhereMouseovered } from './DotplotTooltip'

const blank = { height: 0, left: 0, top: 0, width: 0 }

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'grid',
    padding: 5,
    position: 'relative',
  },
  content: {
    gridColumn: '2/2',
    gridRow: '1/2',
    position: 'relative',
  },

  overlay: {
    // needs to be below controls
    '& path': {
      cursor: 'crosshair',
      fill: 'none',
    },

    display: 'flex',

    gridColumn: '2/2',

    gridRow: '1/2',

    overflow: 'hidden',

    pointerEvents: 'none',

    width: '100%',
    zIndex: 100,
  },
  resizeHandle: {
    background: '#ccc',
    borderTop: '1px solid #fafafa',
    boxSizing: 'border-box',
    height: 4,
  },

  root: {
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    position: 'relative',
  },

  spacer: {
    gridColumn: '1/2',
    gridRow: '2/2',
  },
}))

type Coord = [number, number] | undefined
interface Rect {
  left: number
  top: number
}

// produces offsetX/offsetY coordinates from a clientX and an element's
// getBoundingClientRect
function getOffset(coord: Coord, rect: Rect) {
  return coord && ([coord[0] - rect.left, coord[1] - rect.top] as Coord)
}

const RenderedComponent = observer(({ model }: { model: DotplotViewModel }) => {
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

const DotplotViewInternal = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
  const [mousedownClient, setMouseDownClient] = useState<Coord>()
  const [mouseOvered, setMouseOvered] = useState(false)
  const [mouseupClient, setMouseUpClient] = useState<Coord>()
  const ref = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const distanceX = useRef(0)
  const distanceY = useRef(0)
  const scheduled = useRef(false)
  const [ctrlKeyWasUsed, setCtrlKeyWasUsed] = useState(false)
  const svg = ref.current?.getBoundingClientRect() || blank
  const rootRect = ref.current?.getBoundingClientRect() || blank
  const mousedown = getOffset(mousedownClient, svg)
  const mousecurr = getOffset(mousecurrClient, svg)
  const mouseup = getOffset(mouseupClient, svg)
  const mouserect = mouseup || mousecurr
  const mouserectClient = mouseupClient || mousecurrClient
  const xdistance = mousedown && mouserect ? mouserect[0] - mousedown[0] : 0
  const ydistance = mousedown && mouserect ? mouserect[1] - mousedown[1] : 0
  const { hview, vview, wheelMode, cursorMode } = model

  const validPan =
    (cursorMode === 'move' && !ctrlKeyWasUsed) ||
    (cursorMode === 'crosshair' && ctrlKeyWasUsed)

  const validSelect =
    (cursorMode === 'move' && ctrlKeyWasUsed) ||
    (cursorMode === 'crosshair' && !ctrlKeyWasUsed)

  // use non-React wheel handler to properly prevent body scrolling
  useEffect(() => {
    function onWheel(origEvent: WheelEvent) {
      const event = normalizeWheel(origEvent)
      origEvent.preventDefault()

      distanceX.current += event.pixelX
      distanceY.current -= event.pixelY
      if (!scheduled.current) {
        scheduled.current = true

        window.requestAnimationFrame(() => {
          transaction(() => {
            if (wheelMode === 'pan') {
              hview.scroll(distanceX.current / 3)
              vview.scroll(distanceY.current / 10)
            } else if (wheelMode === 'zoom') {
              if (
                Math.abs(distanceY.current) > Math.abs(distanceX.current) * 2 &&
                mousecurr
              ) {
                const val = distanceY.current < 0 ? 1.1 : 0.9
                hview.zoomTo(hview.bpPerPx * val, mousecurr[0])
                vview.zoomTo(
                  vview.bpPerPx * val,
                  rootRect.height - mousecurr[1],
                )
              }
            }
          })
          scheduled.current = false
          distanceX.current = 0
          distanceY.current = 0
        })
      }
    }
    if (ref.current) {
      const curr = ref.current
      curr.addEventListener('wheel', onWheel)
      return () => curr.removeEventListener('wheel', onWheel)
    }
    return () => {}
  }, [hview, vview, wheelMode, mousecurr, rootRect.height])

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      setMouseCurrClient([event.clientX, event.clientY])

      if (mousecurrClient && mousedownClient && validPan && !mouseupClient) {
        hview.scroll(-event.clientX + mousecurrClient[0])
        vview.scroll(event.clientY - mousecurrClient[1])
      }
    }

    window.addEventListener('mousemove', globalMouseMove)
    return () => window.removeEventListener('mousemove', globalMouseMove)
  }, [
    validPan,
    mousecurrClient,
    mousedownClient,
    cursorMode,
    ctrlKeyWasUsed,
    mouseupClient,
    hview,
    vview,
  ])

  // detect a mouseup after a mousedown was submitted, autoremoves mouseup once
  // that single mouseup is set
  useEffect(() => {
    function globalMouseUp(event: MouseEvent) {
      if (Math.abs(xdistance) > 3 && Math.abs(ydistance) > 3 && validSelect) {
        setMouseUpClient([event.clientX, event.clientY])
      } else {
        setMouseDownClient(undefined)
      }
    }
    if (mousedown && !mouseup) {
      window.addEventListener('mouseup', globalMouseUp, true)
      return () => {
        window.removeEventListener('mouseup', globalMouseUp, true)
      }
    } else {
      return () => {}
    }
  }, [
    validSelect,
    mousedown,
    mousecurr,
    mouseup,
    xdistance,
    ydistance,
    ctrlKeyWasUsed,
    cursorMode,
  ])

  return (
    <div>
      <Header
        model={model}
        selection={
          !validSelect || !(mousedown && mouserect)
            ? undefined
            : {
                height: Math.abs(ydistance),
                width: Math.abs(xdistance),
              }
        }
      />
      <div
        ref={root}
        className={classes.root}
        onMouseLeave={() => setMouseOvered(false)}
        onMouseEnter={() => setMouseOvered(true)}
      >
        <div className={classes.container}>
          <VerticalAxis model={model} />
          <HorizontalAxis model={model} />
          <div ref={ref} className={classes.content}>
            {mouseOvered && validSelect ? (
              <TooltipWhereMouseovered
                model={model}
                mouserect={mouserect}
                mouserectClient={mouserectClient}
                xdistance={xdistance}
              />
            ) : null}
            {validSelect ? (
              <TooltipWhereClicked
                model={model}
                mousedown={mousedown}
                mousedownClient={mousedownClient}
                xdistance={xdistance}
                ydistance={ydistance}
              />
            ) : null}
            <div
              style={{ cursor: ctrlKeyWasUsed ? 'pointer' : cursorMode }}
              onMouseDown={event => {
                if (event.button === 0) {
                  const { clientX, clientY } = event
                  setMouseDownClient([clientX, clientY])
                  setMouseCurrClient([clientX, clientY])
                  setCtrlKeyWasUsed(event.ctrlKey)
                }
              }}
            >
              <Grid model={model}>
                {validSelect && mousedown && mouserect ? (
                  <rect
                    fill="rgba(255,0,0,0.3)"
                    x={Math.min(mouserect[0], mousedown[0])}
                    y={Math.min(mouserect[1], mousedown[1])}
                    width={Math.abs(xdistance)}
                    height={Math.abs(ydistance)}
                  />
                ) : null}
              </Grid>
            </div>
            <div className={classes.spacer} />
          </div>
          <RenderedComponent model={model} />
          <Menu
            open={Boolean(mouseup)}
            onMenuItemClick={(_, callback) => {
              callback()
              setMouseUpClient(undefined)
              setMouseDownClient(undefined)
            }}
            onClose={() => {
              setMouseUpClient(undefined)
              setMouseDownClient(undefined)
            }}
            anchorReference="anchorPosition"
            anchorPosition={
              mouseupClient
                ? {
                    left: mouseupClient[0] + 50,
                    top: mouseupClient[1] + 50,
                  }
                : undefined
            }
            style={{ zIndex: 10000 }}
            menuItems={[
              {
                label: 'Zoom in',
                onClick: () => {
                  if (mousedown && mouseup) {
                    model.zoomIn(mousedown, mouseup)
                  }
                  // below line is needed to prevent tooltip from sticking
                  setMouseOvered(false)
                },
              },
              {
                label: 'Open linear synteny view',
                onClick: () => {
                  if (mousedown && mouseup) {
                    model.onDotplotView(mousedown, mouseup)
                  }
                  // below line is needed to prevent tooltip from sticking
                  setMouseOvered(false)
                },
              },
            ]}
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
const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
  const { initialized, loading, error } = model

  if ((!initialized && !loading) || error) {
    return <ImportForm model={model} />
  }

  if (loading) {
    return <LoadingEllipses variant="h6" />
  }

  return <DotplotViewInternal model={model} />
})

export default DotplotView
