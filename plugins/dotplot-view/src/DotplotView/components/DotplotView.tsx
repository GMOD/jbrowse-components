import React, { useState, useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { LinearProgress } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Menu, ResizeHandle } from '@jbrowse/core/ui'
import normalizeWheel from 'normalize-wheel'

// locals
import { DotplotViewModel } from '../model'
import ImportForm from './ImportForm'
import Header from './Header'
import { locstr } from './util'
import { HorizontalAxis, VerticalAxis } from './Axes'

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

  popover: {
    background: '#fff',
    maxWidth: 400,
    wordBreak: 'break-all',
    zIndex: 1000,
    border: '1px solid black',
    pointerEvents: 'none',
    position: 'absolute',
  },
}))

type Coord = [number, number] | undefined
type Rect = { left: number; top: number }

const Grid = observer(
  ({
    model,
    children,
    stroke = '#0003',
  }: {
    model: DotplotViewModel
    children: React.ReactNode
    stroke?: string
  }) => {
    const { viewWidth, viewHeight, hview, vview } = model
    const hblocks = hview.dynamicBlocks.contentBlocks
    const vblocks = vview.dynamicBlocks.contentBlocks
    const htop = hview.displayedRegionsTotalPx - hview.offsetPx
    const vtop = vview.displayedRegionsTotalPx - vview.offsetPx
    const hbottom = hblocks[0]?.offsetPx - hview.offsetPx
    const vbottom = vblocks[0]?.offsetPx - vview.offsetPx

    return (
      <svg
        style={{ background: 'rgba(0,0,0,0.12)' }}
        width={viewWidth}
        height={viewHeight}
      >
        <rect
          x={hbottom}
          y={viewHeight - vtop}
          width={htop - hbottom}
          height={vtop - vbottom}
          fill="#fff"
        />
        <g>
          {hblocks.map(region => {
            const x = region.offsetPx - hview.offsetPx
            return (
              <line
                key={JSON.stringify(region)}
                x1={x}
                y1={0}
                x2={x}
                y2={viewHeight}
                stroke={stroke}
              />
            )
          })}
          {vblocks.map(region => {
            const y = viewHeight - (region.offsetPx - vview.offsetPx)
            return (
              <line
                key={JSON.stringify(region)}
                x1={0}
                y1={y}
                x2={viewWidth}
                y2={y}
                stroke={stroke}
              />
            )
          })}
          <line x1={htop} y1={0} x2={htop} y2={viewHeight} stroke={stroke} />
          <line
            x1={0}
            y1={viewHeight - vtop}
            x2={viewWidth}
            y2={viewHeight - vtop}
            stroke={stroke}
          />
        </g>
        {children}
      </svg>
    )
  },
)
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

const DotplotViewInternal = observer(
  ({ model }: { model: DotplotViewModel }) => {
    const { hview, vview, viewHeight } = model
    const { classes } = useStyles()
    const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
    const [mousedownClient, setMouseDownClient] = useState<Coord>()
    const [mouseOvered, setMouseOvered] = useState(false)
    const [mouseupClient, setMouseUpClient] = useState<Coord>()
    const ref = useRef<HTMLDivElement>(null)
    const root = useRef<HTMLDivElement>(null)
    const distanceX = useRef(0)
    const distanceY = useRef(0)
    const lref = useRef<HTMLDivElement>(null)
    const rref = useRef<HTMLDivElement>(null)
    const scheduled = useRef(false)
    const blank = { left: 0, top: 0, width: 0, height: 0 }
    const svg = ref.current?.getBoundingClientRect() || blank
    const rrect = rref.current?.getBoundingClientRect() || blank
    const lrect = lref.current?.getBoundingClientRect() || blank
    const mousedown = getOffset(mousedownClient, svg)
    const mousecurr = getOffset(mousecurrClient, svg)
    const mouseup = getOffset(mouseupClient, svg)
    const mouserect = mouseup || mousecurr
    let selection
    if (mousedown && mousecurr) {
      selection = {
        width: Math.abs(mousedown[0] - mousecurr[0]),
        height: Math.abs(mousedown[1] - mousecurr[1]),
      }
    }
    if (mouseup && mousedown) {
      selection = {
        width: Math.abs(mouseup[0] - mousedown[0]),
        height: Math.abs(mouseup[1] - mousedown[1]),
      }
    }

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
              model.hview.scroll(distanceX.current)
              model.vview.scroll(distanceY.current)
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
        return () => {
          curr.removeEventListener('wheel', onWheel)
        }
      }
      return () => {}
    }, [model.hview, model.vview])

    useEffect(() => {
      function globalMouseMove(event: MouseEvent) {
        setMouseCurrClient([event.clientX, event.clientY])
      }

      window.addEventListener('mousemove', globalMouseMove)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove)
      }
    }, [])

    // detect a mouseup after a mousedown was submitted, autoremoves mouseup
    // once that single mouseup is set
    useEffect(() => {
      let cleanup = () => {}

      function globalMouseUp(event: MouseEvent) {
        if (
          mousedown &&
          mousecurr &&
          Math.abs(mousedown[0] - mousecurr[0]) > 3 &&
          Math.abs(mousedown[1] - mousecurr[1]) > 3
        ) {
          setMouseUpClient([event.clientX, event.clientY])
        } else {
          setMouseDownClient(undefined)
        }
      }

      if (mousedown && !mouseup) {
        window.addEventListener('mouseup', globalMouseUp, true)
        cleanup = () => {
          window.removeEventListener('mouseup', globalMouseUp, true)
        }
      }
      return cleanup
    }, [mousedown, mousecurr, mouseup])

    return (
      <div>
        <Header model={model} selection={selection} />
        <div
          ref={root}
          className={classes.root}
          onMouseLeave={() => setMouseOvered(false)}
          onMouseEnter={() => setMouseOvered(true)}
        >
          <div
            className={classes.container}
            style={{
              transform: `scaleX(${model.hview.scaleFactor}) scaleY(${model.vview.scaleFactor})`,
            }}
          >
            <VerticalAxis model={model} />
            <HorizontalAxis model={model} />
            <div ref={ref} className={classes.content}>
              {mouseOvered && mouserect ? (
                <div
                  ref={lref}
                  className={classes.popover}
                  style={{
                    left:
                      6 +
                      mouserect[0] -
                      (mousedown && mouserect[0] - mousedown[0] < 0
                        ? lrect.width + 12
                        : 0),
                    top:
                      6 +
                      mouserect[1] -
                      (mousedown && mouserect[1] - mousedown[1] < 0
                        ? lrect.height + 12
                        : 0),
                  }}
                >
                  {`x - ${locstr(mouserect[0], hview)}`}
                  <br />
                  {`y - ${locstr(viewHeight - mouserect[1], vview)}`}
                  <br />
                </div>
              ) : null}
              {mousedown &&
              mouserect &&
              Math.abs(mousedown[0] - mouserect[0]) > 3 &&
              Math.abs(mousedown[1] - mouserect[1]) > 3 ? (
                <div
                  ref={rref}
                  className={classes.popover}
                  style={{
                    left:
                      mousedown[0] -
                      (mouserect[0] - mousedown[0] < 0 ? 0 : rrect.width),
                    top:
                      mousedown[1] -
                      (mouserect[1] - mousedown[1] < 0 ? 0 : rrect.height),
                  }}
                >
                  {`x - ${locstr(mousedown[0], hview)}`}
                  <br />
                  {`y - ${locstr(viewHeight - mousedown[1], vview)}`}
                  <br />
                </div>
              ) : null}

              <div
                role="presentation"
                style={{ cursor: 'crosshair' }}
                onMouseDown={event => {
                  if (event.button === 0) {
                    setMouseDownClient([event.clientX, event.clientY])
                    setMouseCurrClient([event.clientX, event.clientY])
                  }
                }}
              >
                <Grid model={model}>
                  {mousedown && mouserect ? (
                    <rect
                      fill="rgba(255,0,0,0.3)"
                      x={Math.min(mouserect[0], mousedown[0])}
                      y={Math.min(mouserect[1], mousedown[1])}
                      width={Math.abs(mouserect[0] - mousedown[0])}
                      height={Math.abs(mouserect[1] - mousedown[1])}
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
  },
)
const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
  const { initialized, loading, error } = model

  if ((!initialized && !loading) || error) {
    return <ImportForm model={model} />
  }

  if (loading) {
    return (
      <div>
        <p>Loading...</p>
        <LinearProgress />
      </div>
    )
  }

  return <DotplotViewInternal model={model} />
})

export default DotplotView
