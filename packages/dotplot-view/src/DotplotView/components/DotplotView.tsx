import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { LinearProgress } from '@material-ui/core'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { Menu } from '@gmod/jbrowse-core/ui'
import { BaseBlock } from '@gmod/jbrowse-core/util/blockTypes'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { DotplotViewModel } from '../model'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const ImportForm = jbrequire(require('./ImportForm'))
  const Controls = jbrequire(require('./Controls'))

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
      if (
        y === positions.length ||
        positions.slice(y, y + 12).some(pos => pos)
      ) {
        blockLabelKeysToHide.push(key)
      } else {
        positions.fill(true, y, y + 12)
      }
    })
    return blockLabelKeysToHide
  }

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const [mousecurr, setMouseCurr] = useState([0, 0])
    const [mousedown, setMouseDown] = useState<Coord>()
    const [mouseup, setMouseUp] = useState<Coord>()
    const [tracking, setTracking] = useState(false)

    const {
      initialized,
      loading,
      error,
      hview,
      vview,
      borderY,
      borderX,
      viewHeight,
      viewWidth,
      htextRotation,
      vtextRotation,
    } = model

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
            <svg className={classes.vtext} width={borderX} height={viewHeight}>
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
              className={classes.content}
              width={viewWidth}
              height={viewHeight}
              onWheel={event => {
                model.hview.scroll(event.deltaX)
                model.vview.scroll(-event.deltaY)
                event.preventDefault()
              }}
              onMouseMove={event => {
                if (tracking) {
                  setMouseCurr([
                    event.nativeEvent.offsetX,
                    event.nativeEvent.offsetY,
                  ])
                }
              }}
              onMouseUp={event => {
                if (mousedown) {
                  setMouseUp([
                    event.nativeEvent.offsetX,
                    event.nativeEvent.offsetY,
                  ])
                  setTracking(false)
                }
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
                  .map((region, index, array) => {
                    const x = region.offsetPx
                    const y = tickSize
                    return (
                      <text
                        transform={`rotate(${htextRotation},${
                          x - hview.offsetPx
                        },${y})`}
                        key={region.refName}
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
              menuOptions={[
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
  })

  return DotplotView
}
