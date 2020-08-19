import React, { useState, useEffect, useRef } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { LinearProgress } from '@material-ui/core'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { Menu } from '@gmod/jbrowse-core/ui'
import { BaseBlock } from '@gmod/jbrowse-core/util/blockTypes'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import normalizeWheel from 'normalize-wheel'
import { DotplotViewModel, Dotplot1DViewModel } from '../model'

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
    },
    error: {
      color: 'red',
    },
    popover: {
      background: '#fff',
      zIndex: 1000,
      border: '1px solid black',
      pointerEvents: 'none',
      position: 'absolute',
    },
  }
})

type Coord = [number, number] | undefined

function locstr(px: number, view: Dotplot1DViewModel) {
  const obj = view.pxToBp(px)
  return `${obj.refName}:${Math.floor(obj.offset).toLocaleString('en-US')}`
}

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const ImportForm = jbrequire(require('./ImportForm'))
  const Controls = jbrequire(require('./Controls'))

  function getBlockLabelKeysToHide(
    blocks: BaseBlock[],
    length: number,
    viewOffsetPx: number,
  ) {
    const blockLabelKeysToHide: string[] = []
    const sortedBlocks = blocks
      .filter(block => block.refName)
      .map(({ start, end, key, offsetPx }) => ({
        start,
        end,
        key,
        offsetPx,
      }))
      .sort((a, b) => b.end - b.start - (a.end - a.start))
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

  // produces offsetX/offsetY coordinates from a clientX and an element's getBoundingClientRect
  function getOffset(coord: Coord, rect: { left: number; top: number }) {
    return coord && ([coord[0] - rect.left, coord[1] - rect.top] as Coord)
  }
  const DotplotViewInternal = observer(
    ({ model }: { model: DotplotViewModel }) => {
      const {
        hview,
        vview,
        borderY,
        borderX,
        viewHeight,
        viewWidth,
        htextRotation,
        vtextRotation,
      } = model
      const classes = useStyles()
      const [mousecurrClient, setMouseCurrClient] = useState<Coord>()
      const [mousedownClient, setMouseDownClient] = useState<Coord>()
      const [mouseupClient, setMouseUpClient] = useState<Coord>()
      const ref = useRef<SVGSVGElement>(null)
      const root = useRef<HTMLDivElement>(null)
      const distanceX = useRef(0)
      const distanceY = useRef(0)
      const scheduled = useRef(false)

      // require non-react wheel handler to properly prevent body scrolling
      useEffect(() => {
        function onWheel(origEvent: WheelEvent) {
          const event = normalizeWheel(origEvent)
          origEvent.preventDefault()
          if (origEvent.ctrlKey === true) {
            const { pixelY } = event
            const { offsetX, offsetY } = origEvent
            const factor = 1 + pixelY/500
            model.vview.zoomTo(model.vview.bpPerPx * factor, offsetY)
            model.hview.zoomTo(model.hview.bpPerPx * factor, offsetX)
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
      })

      const tickSize = 0
      const verticalBlockLabelKeysToHide = getBlockLabelKeysToHide(
        vview.dynamicBlocks.blocks,
        viewHeight,
        vview.offsetPx,
      )
      const horizontalBlockLabelKeysToHide = getBlockLabelKeysToHide(
        hview.dynamicBlocks.blocks,
        viewWidth,
        hview.offsetPx,
      )
      const rect = root.current?.getBoundingClientRect() || { left: 0, top: 0 }
      const svg = ref.current?.getBoundingClientRect() || { left: 0, top: 0 }
      const mousedown = getOffset(mousedownClient, svg)
      const mousecurr = getOffset(mousecurrClient, svg)
      const mouseup = getOffset(mouseupClient, svg)
      return (
        <div ref={root} className={classes.root}>
          <Controls model={model} />
          {mousecurr && mousecurrClient ? (
            <div
              className={classes.popover}
              style={{
                left:
                  mousecurrClient[0] -
                  rect.left +
                  (mousedown && mousecurr[0] - mousedown[0] < 0 ? -120 : 20),
                top:
                  mousecurrClient[1] -
                  rect.top +
                  (mousedown && mousecurr[1] - mousedown[1] < 0 ? -40 : 0),
              }}
            >
              {`x-${locstr(mousecurr[0], hview)}`}
              <br />
              {`y-${locstr(viewHeight - mousecurr[1], vview)}`}
            </div>
          ) : null}
          {mousedown &&
          mousecurr &&
          mousedownClient &&
          Math.abs(mousedown[0] - mousecurr[0]) > 3 &&
          Math.abs(mousedown[1] - mousecurr[1]) > 3 ? (
            <div
              className={classes.popover}
              style={{
                left:
                  mousedownClient[0] -
                  rect.left -
                  (mousecurr[0] - mousedown[0] < 0 ? 0 : 120),
                top:
                  mousedownClient[1] -
                  rect.top -
                  (mousecurr[1] - mousedown[1] < 0 ? 0 : 40),
              }}
            >
              {`x-${locstr(mousedown[0], hview)}`}
              <br />
              {`y-${locstr(viewHeight - mousedown[1], vview)}`}
            </div>
          ) : null}
          <div className={classes.container}>
            <div style={{ display: 'grid' }}>
              <svg
                className={classes.vtext}
                width={borderX}
                height={viewHeight}
              >
                <g>
                  {vview.dynamicBlocks.blocks
                    .filter(
                      region =>
                        region.refName &&
                        !verticalBlockLabelKeysToHide.includes(region.key),
                    )
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
                          {region.refName}
                        </text>
                      )
                    })}
                </g>
              </svg>

              <svg
                ref={ref}
                className={classes.content}
                width={viewWidth}
                height={viewHeight}
                style={{ cursor: 'crosshair' }}
                onMouseLeave={() => {
                  // the mouseleave is called on mouseup when the menu appears
                  // so disable leave for this, but otherwise make cursor/zoombox go away
                  if (!mouseup) {
                    setMouseDownClient(undefined)
                    setMouseCurrClient(undefined)
                  }
                }}
                onMouseMove={event => {
                  setMouseCurrClient([event.clientX, event.clientY])
                }}
                onMouseUp={event => {
                  if (
                    mousedown &&
                    mousecurr &&
                    Math.abs(mousedown[0] - mousecurr[0]) > 3 &&
                    Math.abs(mousedown[1] - mousecurr[1]) > 3
                  ) {
                    setMouseUpClient([event.clientX, event.clientY])
                  }
                }}
                onMouseDown={event => {
                  if (event.button === 0) {
                    setMouseDownClient([event.clientX, event.clientY])
                    setMouseCurrClient([event.clientX, event.clientY])
                  }
                }}
              >
                <g>
                  {hview.dynamicBlocks.blocks
                    .filter(region => region.refName)
                    .map(region => {
                      const x = region.offsetPx - hview.offsetPx
                      return (
                        <line
                          key={JSON.stringify(region)}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={viewHeight}
                          stroke="#000000"
                        />
                      )
                    })}
                  {vview.dynamicBlocks.blocks
                    .filter(region => region.refName)
                    .map(region => {
                      const y = viewHeight - (region.offsetPx - vview.offsetPx)

                      return (
                        <line
                          key={JSON.stringify(region)}
                          x1={0}
                          y1={y}
                          x2={viewWidth}
                          y2={y}
                          stroke="#000000"
                        />
                      )
                    })}
                </g>
                {mousedown && mousecurr ? (
                  <rect
                    fill="rgba(255,0,0,0.3)"
                    x={Math.min(mousecurr[0], mousedown[0])}
                    y={Math.min(mousecurr[1], mousedown[1])}
                    width={Math.abs(mousecurr[0] - mousedown[0])}
                    height={Math.abs(mousecurr[1] - mousedown[1])}
                  />
                ) : null}
              </svg>
              <div className={classes.spacer} />
              <svg width={viewWidth} height={borderY} className={classes.htext}>
                <g>
                  {hview.dynamicBlocks.blocks
                    .filter(
                      region =>
                        region.refName &&
                        !horizontalBlockLabelKeysToHide.includes(region.key),
                    )
                    .map(region => {
                      const x = region.offsetPx
                      const y = tickSize
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
                          {region.refName}
                        </text>
                      )
                    })}
                </g>
              </svg>
              <div className={classes.overlay}>
                {model.tracks.map(track => {
                  const { ReactComponent } = track

                  return ReactComponent ? (
                    // @ts-ignore
                    <ReactComponent
                      key={getConf(track, 'trackId')}
                      model={track}
                    />
                  ) : null
                })}
              </div>
              <Menu
                open={Boolean(mouseup)}
                onMenuItemClick={(event, callback) => {
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

  return DotplotView
}
