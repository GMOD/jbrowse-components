import React, { useState, useEffect, useRef } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { LinearProgress } from '@material-ui/core'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { Menu } from '@gmod/jbrowse-core/ui'
import { BaseBlock } from '@gmod/jbrowse-core/util/blockTypes'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { DotplotViewModel } from '../model'

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
  }
})

type Coord = [number, number] | undefined

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
      const [mousecurr, setMouseCurr] = useState([0, 0])
      const [mousedown, setMouseDown] = useState<Coord>()
      const [mouseup, setMouseUp] = useState<Coord>()
      const [tracking, setTracking] = useState(false)
      const ref = useRef<SVGSVGElement>(null)
      const distanceX = useRef(0)
      const distanceY = useRef(0)
      const scheduled = useRef(false)

      // require non-react wheel handler to properly prevent body scrolling
      useEffect(() => {
        function onWheel(event: WheelEvent) {
          event.preventDefault()

          distanceX.current += event.deltaX
          distanceY.current -= event.deltaY
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
      return (
        <div style={{ position: 'relative' }}>
          <Controls model={model} />
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
                onMouseMove={event => {
                  if (tracking) {
                    setMouseCurr([
                      event.nativeEvent.offsetX,
                      event.nativeEvent.offsetY,
                    ])
                  }
                }}
                onMouseUp={event => {
                  if (
                    mousedown &&
                    Math.abs(mousedown[0] - mousecurr[0]) > 3 &&
                    Math.abs(mousedown[1] - mousecurr[1]) > 3
                  ) {
                    setMouseUp([event.pageX, event.pageY])
                  }
                  setTracking(false)
                }}
                onMouseDown={event => {
                  if (event.button === 0) {
                    setMouseDown([
                      event.nativeEvent.offsetX,
                      event.nativeEvent.offsetY,
                    ])
                    setMouseCurr([
                      event.nativeEvent.offsetX,
                      event.nativeEvent.offsetY,
                    ])
                    setTracking(true)
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
                {mousedown ? (
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
                  setMouseUp(undefined)
                  setMouseDown(undefined)
                }}
                onClose={() => {
                  setMouseUp(undefined)
                  setMouseDown(undefined)
                }}
                anchorReference="anchorPosition"
                anchorPosition={
                  mouseup ? { top: mouseup[1], left: mouseup[0] } : undefined
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
