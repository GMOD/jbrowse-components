import React, { useState, useEffect, useRef } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { LinearProgress } from '@material-ui/core'
import { getConf } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import normalizeWheel from 'normalize-wheel'
import { DotplotViewModel, Dotplot1DViewModel } from '../model'
import ImportForm from './ImportForm'
import Controls from './Controls'

const useStyles = makeStyles(theme => {
  return {
    root: {
      position: 'relative',
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
    },
    viewContainer: {
      marginTop: '3px',
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
    vtext: {
      gridColumn: '1/2',
      gridRow: '1/2',
      pointerEvents: 'none',
    },
    content: {
      gridColumn: '2/2',
      gridRow: '1/2',
    },
    spacer: {
      gridColumn: '1/2',
      gridRow: '2/2',
    },
    htext: {
      gridColumn: '2/2',
      gridRow: '2/2',
      pointerEvents: 'none',
    },
    error: {
      color: 'red',
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
    majorTickLabel: {
      fontSize: '11px',
    },
    majorTick: {
      stroke: '#555',
    },
    minorTick: {
      stroke: '#999',
    },
  }
})

type Coord = [number, number] | undefined
type Timer = ReturnType<typeof setTimeout>
type Rect = { left: number; top: number }

function locstr(px: number, view: Dotplot1DViewModel) {
  const { refName, start, offset, oob } = view.pxToBp(px)
  const coord = Math.floor(start + offset)
  return oob ? 'out of bounds' : `${refName}:${coord.toLocaleString('en-US')}`
}

function getBlockLabelKeysToHide(
  blocks: BaseBlock[],
  length: number,
  viewOffsetPx: number,
) {
  const blockLabelKeysToHide: string[] = []
  const sortedBlocks = blocks.slice(0).sort((a, b) => {
    const alen = a.end - a.start
    const blen = b.end - b.start
    return blen - alen
  })
  const positions = new Array(Math.round(length))
  sortedBlocks.forEach(({ key, offsetPx }) => {
    const y = Math.round(length - offsetPx + viewOffsetPx)
    const labelBounds = [Math.max(y - 12, 0), y]
    if (y === 0 || positions.slice(...labelBounds).some(Boolean)) {
      blockLabelKeysToHide.push(key)
    } else {
      positions.fill(true, ...labelBounds)
    }
  })
  return blockLabelKeysToHide
}
/**
 * Given a scale ( bp/px ) and minimum distances (px) between major and minor
 * gridlines, return an object like `{ majorPitch: bp, minorPitch: bp }` giving
 * the gridline pitches to use.
 */
export function chooseGridPitch(
  scale: number,
  minMajorPitchPx: number,
  minMinorPitchPx: number,
) {
  scale = Math.abs(scale)
  const minMajorPitchBp = minMajorPitchPx * scale
  const majorMagnitude = parseInt(
    Number(minMajorPitchBp).toExponential().split(/e/i)[1],
    10,
  )

  let majorPitch = 10 ** majorMagnitude
  while (majorPitch < minMajorPitchBp) {
    majorPitch *= 2
    if (majorPitch >= minMajorPitchBp) {
      break
    }
    majorPitch *= 2.5
  }

  majorPitch = Math.max(majorPitch, 5)

  const majorPitchPx = majorPitch / scale

  let minorPitch = 0
  if (!(majorPitch % 10) && majorPitchPx / 10 >= minMinorPitchPx) {
    minorPitch = majorPitch / 10
  } else if (!(majorPitch % 5) && majorPitchPx / 5 >= minMinorPitchPx) {
    minorPitch = majorPitch / 5
  } else if (!(majorPitch % 2) && majorPitchPx / 2 >= minMinorPitchPx) {
    minorPitch = majorPitch / 2
  }

  return { majorPitch, minorPitch }
}

function makeTicks(
  regions: BaseBlock[],
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  const ticks = []
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)
  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]
    const { start, end, refName } = region
    let index = 0

    const minBase = start
    const maxBase = end
    for (
      let base = Math.ceil(minBase / iterPitch) * iterPitch;
      base < maxBase;
      base += iterPitch
    ) {
      if (emitMinor && base % gridPitch.majorPitch) {
        ticks.push({ type: 'minor', base: base - 1, index, refName })
        index += 1
      } else if (
        emitMajor &&
        Math.abs(base - region.start) > gridPitch.minorPitch
      ) {
        ticks.push({ type: 'major', base: base - 1, index, refName })
        index += 1
      }
    }
  }
  return ticks
}

const HorizontalAxis = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  const { viewWidth, borderY, hview, htextRotation } = model
  const hide = getBlockLabelKeysToHide(
    hview.dynamicBlocks.contentBlocks,
    viewWidth,
    hview.offsetPx,
  )
  const ticks = makeTicks(hview.staticBlocks.contentBlocks, hview.bpPerPx)
  return (
    <svg width={viewWidth} height={borderY} className={classes.htext}>
      <g>
        {hview.dynamicBlocks.contentBlocks
          .filter(region => !hide.includes(region.key))
          .map(region => {
            const x = region.offsetPx
            const y = 0
            return (
              <text
                transform={`rotate(${htextRotation},${
                  x - hview.offsetPx
                },${y})`}
                key={JSON.stringify(region)}
                x={x - hview.offsetPx}
                y={y + 1}
                fill="#000000"
                dominantBaseline="hanging"
                textAnchor="end"
              >
                {`${region.refName}:${
                  region.start !== 0
                    ? Math.floor(region.start).toLocaleString('en-US')
                    : ''
                }`}
              </text>
            )
          })}
        {ticks.map(tick => {
          const x =
            (hview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
            hview.offsetPx
          return (
            <line
              key={`line-${JSON.stringify(tick)}`}
              x1={x}
              x2={x}
              y1={0}
              y2={tick.type === 'major' ? 6 : 4}
              strokeWidth={1}
              stroke={tick.type === 'major' ? '#555' : '#999'}
              className={
                tick.type === 'major' ? classes.majorTick : classes.minorTick
              }
              data-bp={tick.base}
            />
          )
        })}
        {ticks
          .filter(tick => tick.type === 'major')
          .map(tick => {
            const x =
              (hview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
              hview.offsetPx
            const y = 0
            return (
              <text
                x={x - 7}
                y={y}
                transform={`rotate(${htextRotation},${x},${y})`}
                key={`text-${JSON.stringify(tick)}`}
                style={{ fontSize: '11px' }}
                className={classes.majorTickLabel}
                dominantBaseline="middle"
                textAnchor="end"
              >
                {(tick.base + 1).toLocaleString('en-US')}
              </text>
            )
          })}
      </g>
    </svg>
  )
})
const VerticalAxis = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  const { borderX, viewHeight, vview, vtextRotation } = model
  const hide = getBlockLabelKeysToHide(
    vview.dynamicBlocks.contentBlocks,
    viewHeight,
    vview.offsetPx,
  )
  const ticks = makeTicks(vview.staticBlocks.contentBlocks, vview.bpPerPx)
  return (
    <svg className={classes.vtext} width={borderX} height={viewHeight}>
      <g>
        {vview.dynamicBlocks.contentBlocks
          .filter(region => !hide.includes(region.key))
          .map(region => {
            const y = region.offsetPx
            const x = borderX
            return (
              <text
                transform={`rotate(${vtextRotation},${x},${y})`}
                key={JSON.stringify(region)}
                x={borderX}
                y={viewHeight - y + vview.offsetPx}
                fill="#000000"
                textAnchor="end"
              >
                {`${region.refName}:${
                  region.start !== 0 ? Math.floor(region.start) : ''
                }`}
              </text>
            )
          })}
        {ticks.map(tick => {
          const y =
            (vview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
            vview.offsetPx
          return (
            <line
              key={`line-${JSON.stringify(tick)}`}
              y1={viewHeight - y}
              y2={viewHeight - y}
              x1={borderX}
              x2={borderX - (tick.type === 'major' ? 6 : 4)}
              strokeWidth={1}
              stroke={tick.type === 'major' ? '#555' : '#999'}
              className={
                tick.type === 'major' ? classes.majorTick : classes.minorTick
              }
              data-bp={tick.base}
            />
          )
        })}
        {ticks
          .filter(tick => tick.type === 'major')
          .map(tick => {
            const y =
              (vview.bpToPx({ refName: tick.refName, coord: tick.base }) || 0) -
              vview.offsetPx
            return (
              <text
                y={viewHeight - y - 3}
                x={borderX - 7}
                key={`text-${JSON.stringify(tick)}`}
                textAnchor="end"
                dominantBaseline="hanging"
                style={{ fontSize: '11px' }}
                className={classes.majorTickLabel}
              >
                {(tick.base + 1).toLocaleString('en-US')}
              </text>
            )
          })}
      </g>
    </svg>
  )
})

const Grid = observer(
  ({
    model,
    children,
    stroke = '#000a',
  }: {
    model: DotplotViewModel
    children: React.ReactNode
    stroke?: string
  }) => {
    const { viewWidth, viewHeight, hview, vview } = model
    const hblocks = hview.dynamicBlocks.contentBlocks
    const vblocks = vview.dynamicBlocks.contentBlocks
    const htop = hview.displayedRegionsTotalPx - hview.offsetPx
    const hbottom = hblocks[0].offsetPx - hview.offsetPx
    const vtop = vview.displayedRegionsTotalPx - vview.offsetPx
    const vbottom = vblocks[0].offsetPx - vview.offsetPx
    return (
      <svg
        style={{ background: 'rgba(0,0,0,0.12)' }}
        width={viewWidth}
        height={viewHeight}
      >
        {' '}
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

const DotplotViewInternal = observer(
  ({ model }: { model: DotplotViewModel }) => {
    const { hview, vview, viewHeight } = model
    const classes = useStyles()
    const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
    const [mousedownClient, setMouseDownClient] = useState<Coord>()
    const [mouseupClient, setMouseUpClient] = useState<Coord>()
    const ref = useRef<HTMLDivElement>(null)
    const root = useRef<HTMLDivElement>(null)
    const distanceX = useRef(0)
    const distanceY = useRef(0)
    const lref = useRef<HTMLDivElement>(null)
    const rref = useRef<HTMLDivElement>(null)
    const timeout = useRef<Timer>()
    const delta = useRef(0)
    const scheduled = useRef(false)
    const blank = { left: 0, top: 0, width: 0, height: 0 }
    const svg = ref.current?.getBoundingClientRect() || blank
    const rrect = rref.current?.getBoundingClientRect() || blank
    const lrect = lref.current?.getBoundingClientRect() || blank
    const mousedown = getOffset(mousedownClient, svg)
    const mousecurr = getOffset(mousecurrClient, svg)
    const mouseup = getOffset(mouseupClient, svg)
    const mouserect = mouseup || mousecurr

    // use non-React wheel handler to properly prevent body scrolling
    useEffect(() => {
      function onWheel(origEvent: WheelEvent) {
        const event = normalizeWheel(origEvent)
        origEvent.preventDefault()
        if (origEvent.ctrlKey === true) {
          delta.current += event.pixelY / 500
          model.vview.setScaleFactor(
            delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
          )
          model.hview.setScaleFactor(
            delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
          )
          if (timeout.current) {
            clearTimeout(timeout.current)
          }
          timeout.current = setTimeout(() => {
            transaction(() => {
              model.hview.setScaleFactor(1)
              model.vview.setScaleFactor(1)
              model.hview.zoomTo(
                delta.current > 0
                  ? model.hview.bpPerPx * (1 + delta.current)
                  : model.hview.bpPerPx / (1 - delta.current),
              )
              model.vview.zoomTo(
                delta.current > 0
                  ? model.vview.bpPerPx * (1 + delta.current)
                  : model.vview.bpPerPx / (1 - delta.current),
              )
            })
            delta.current = 0
          }, 300)
        } else {
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
      <div ref={root} className={classes.root}>
        <Controls model={model} />

        <div className={classes.container}>
          <div
            style={{
              display: 'grid',
              transform: `scaleX(${model.hview.scaleFactor}) scaleY(${model.vview.scaleFactor})`,
            }}
          >
            <VerticalAxis model={model} />
            <HorizontalAxis model={model} />
            <div
              ref={ref}
              style={{ position: 'relative' }}
              className={classes.content}
            >
              {mouserect ? (
                <div
                  ref={lref}
                  className={classes.popover}
                  style={{
                    left:
                      mouserect[0] -
                      (mousedown && mouserect[0] - mousedown[0] < 0
                        ? lrect.width
                        : 0),
                    top:
                      mouserect[1] -
                      (mousedown && mouserect[1] - mousedown[1] < 0
                        ? lrect.height
                        : 0),
                  }}
                >
                  {`x-${locstr(mouserect[0], hview)}`}
                  <br />
                  {`y-${locstr(viewHeight - mouserect[1], vview)}`}
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
                  {`x-${locstr(mousedown[0], hview)}`}
                  <br />
                  {`y-${locstr(viewHeight - mousedown[1], vview)}`}
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
            <div className={classes.overlay}>
              {model.tracks.map(track => {
                const [display] = track.displays
                const { RenderingComponent } = display

                return RenderingComponent ? (
                  <RenderingComponent
                    key={getConf(track, 'trackId')}
                    model={display}
                  />
                ) : null
              })}
            </div>
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
              style={{ zIndex: 1000 }}
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
        </div>
      </div>
    )
  },
)
const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
  const { initialized, loading, error } = model
  const classes = useStyles()

  if (!initialized && !loading) {
    return <ImportForm model={model} />
  }

  if (error) {
    return <p className={classes.error}>{String(error)}</p>
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
