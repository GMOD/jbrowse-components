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
import { HorizontalAxis, VerticalAxis } from './Axes'
import { TooltipWhereClicked, TooltipWhereMouseovered } from './DotplotTooltip'

const blank = { left: 0, top: 0, width: 0, height: 0 }

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
}))

type Coord = [number, number] | undefined
type Rect = { left: number; top: number }

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
  const { cursorMode } = model
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
  const svg = ref.current?.getBoundingClientRect() || blank
  const mousedown = getOffset(mousedownClient, svg)
  const mousecurr = getOffset(mousecurrClient, svg)
  const mouseup = getOffset(mouseupClient, svg)
  const mouserect = mouseup || mousecurr
  const xdistance = mousedown && mouserect ? mouserect[0] - mousedown[0] : 0
  const ydistance = mousedown && mouserect ? mouserect[1] - mousedown[1] : 0
  const { hview, vview } = model

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
            hview.scroll(distanceX.current)
            vview.scroll(distanceY.current)
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
  }, [hview, vview])

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      setMouseCurrClient([event.clientX, event.clientY])

      if (mousecurrClient && mousedownClient && cursorMode === 'move') {
        hview.scroll(-event.clientX + mousecurrClient[0])
        vview.scroll(event.clientY - mousecurrClient[1])
      }
    }

    window.addEventListener('mousemove', globalMouseMove)
    return () => window.removeEventListener('mousemove', globalMouseMove)
  }, [mousecurrClient, mousedownClient, cursorMode, hview, vview])

  // detect a mouseup after a mousedown was submitted, autoremoves mouseup
  // once that single mouseup is set
  useEffect(() => {
    let cleanup = () => {}

    function globalMouseUp(event: MouseEvent) {
      if (
        Math.abs(xdistance) > 3 &&
        Math.abs(ydistance) > 3 &&
        cursorMode === 'crosshair'
      ) {
        setMouseUpClient([event.clientX, event.clientY])
      } else {
        setMouseDownClient(undefined)
      }
    }

    if (mousedown && !mouseup) {
      window.addEventListener('mouseup', globalMouseUp, true)
      cleanup = () => window.removeEventListener('mouseup', globalMouseUp, true)
    }
    return cleanup
  }, [mousedown, mousecurr, mouseup, xdistance, ydistance, cursorMode])

  return (
    <div>
      <Header
        model={model}
        selection={
          cursorMode === 'move' || !(mousedown && mouserect)
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
        onMouseLeave={() => setMouseOvered(false)}
        onMouseEnter={() => setMouseOvered(true)}
      >
        <div
          className={classes.container}
          style={{
            transform: `scaleX(${hview.scaleFactor}) scaleY(${vview.scaleFactor})`,
          }}
        >
          <VerticalAxis model={model} />
          <HorizontalAxis model={model} />
          <div ref={ref} className={classes.content}>
            {mouseOvered && cursorMode === 'crosshair' ? (
              <TooltipWhereMouseovered
                model={model}
                mouserect={mouserect}
                xdistance={xdistance}
                ydistance={ydistance}
              />
            ) : null}
            {cursorMode === 'crosshair' ? (
              <TooltipWhereClicked
                model={model}
                mousedown={mousedown}
                xdistance={xdistance}
                ydistance={ydistance}
              />
            ) : null}
            <div
              style={{ cursor: cursorMode }}
              onMouseDown={event => {
                if (event.button === 0) {
                  const { clientX, clientY } = event
                  setMouseDownClient([clientX, clientY])
                  setMouseCurrClient([clientX, clientY])
                }
              }}
            >
              <Grid model={model}>
                {cursorMode === 'crosshair' && mousedown && mouserect ? (
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
                    top: mouseupClient[1] + 30,
                    left: mouseupClient[0] + 30,
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
                },
              },
              {
                label: 'Open linear synteny view',
                onClick: () => {
                  if (mousedown && mouseup) {
                    model.onDotplotView(mousedown, mouseup)
                  }
                },
              },
            ]}
          />
        </div>
        <ResizeHandle
          onDrag={n => model.setHeight(model.height + n)}
          style={{
            height: 4,
            background: '#ccc',
            boxSizing: 'border-box',
            borderTop: '1px solid #fafafa',
          }}
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
    return <LoadingEllipses variant="h5" />
  }

  return <DotplotViewInternal model={model} />
})

export default DotplotView
