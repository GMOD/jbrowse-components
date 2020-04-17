/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import { useRef as reactUseRef } from 'react'

import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef, useEffect, useState } = React
  const { getSession, minmax } = jbrequire('@gmod/jbrowse-core/util')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles: jbMakeStyles } = jbrequire('@material-ui/core/styles')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const LinearProgress = jbrequire('@material-ui/core/LinearProgress')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ImportForm = jbrequire(require('./ImportForm'))

  const useStyles = (jbMakeStyles as typeof makeStyles)(theme => {
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
        display: 'flex',
        width: '100%',
        gridRow: '1/2',
        gridColumn: '2/2',
        zIndex: 100,
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
      iconButton: {
        padding: '4px',
        margin: '0 2px 0 2px',
      },
      controls: {
        overflow: 'hidden',
        background: 'white',
        whiteSpace: 'nowrap',
        position: 'absolute',
        boxSizing: 'border-box',
        border: '1px solid #a2a2a2',
        right: 0,
        top: 0,
        zIndex: 100,
      },
    }
  })

  const Controls = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const session = getSession(model)
    return (
      <div className={classes.controls}>
        <IconButton
          onClick={model.zoomOutButton}
          className={classes.iconButton}
          color="secondary"
        >
          <Icon fontSize="small">zoom_out</Icon>
        </IconButton>

        <IconButton
          onClick={model.zoomInButton}
          className={classes.iconButton}
          title="zoom in"
          color="secondary"
        >
          <Icon fontSize="small">zoom_in</Icon>
        </IconButton>

        <ToggleButton
          onClick={model.activateTrackSelector}
          title="select tracks"
          selected={
            session.visibleDrawerWidget &&
            session.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
            session.visibleDrawerWidget.view.id === model.id
          }
          value="track_select"
          data-testid="circular_track_select"
          color="secondary"
        >
          <Icon fontSize="small">line_style</Icon>
        </ToggleButton>
      </div>
    )
  })

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = (useRef as typeof reactUseRef)<SVGSVGElement | null>(null)
    const [curr, setCurr] = useState()
    const [down, setDown] = useState()
    const [x, setX] = useState()

    const {
      initialized,
      loading,
      hview,
      vview,
      borderY,
      borderX,
      viewHeight,
      viewWidth,
      htextRotation,
      vtextRotation,
    } = model

    let left = 0
    let top = 0
    if (ref.current) {
      const bounds = ref.current.getBoundingClientRect()
      left = bounds.left
      top = bounds.top
    }
    useEffect(() => {
      function globalMouseMove(event: MouseEvent) {
        setCurr([event.offsetX, event.offsetY])
        event.preventDefault()
      }

      function globalMouseUp(event: MouseEvent) {
        if (down) {
          setDown(undefined)

          const [currX, currY] = [event.clientX, event.clientY]
          const [downX, downY] = down
          const [xmin, xmax] = minmax(currX - left, downX)
          const [ymin, ymax] = minmax(currY - top, downY)
          console.log(xmin, xmax, ymin, ymax)
          const x1 = model.hview.pxToBp(xmin)
          const x2 = model.hview.pxToBp(xmax)

          const y1 = model.vview.pxToBp(viewHeight - ymin)
          const y2 = model.vview.pxToBp(viewHeight - ymax)
          console.log(x1, x2, y1, y2)

          // const xx = [
          //   [
          //     model.hview.bpToPx(x1.refName, x1.offset),
          //     model.vview.bpToPx(y1.refName, y1.offset),
          //   ],
          //   [
          //     model.hview.bpToPx(x2.refName, x2.offset),
          //     model.vview.bpToPx(y2.refName, y2.offset),
          //   ],
          // ]
          // setX(xx)
          model.hview.moveTo(x1, x2)
          model.vview.moveTo(y1, y2)
        }
      }

      window.addEventListener('mousemove', globalMouseMove)
      window.addEventListener('mouseup', globalMouseUp)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove)
        window.removeEventListener('mouseup', globalMouseUp)
      }
    }, [down, left, model, top, viewHeight])

    if (!initialized && !loading) {
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

    const tickSize = 0

    return (
      <div style={{ position: 'relative' }}>
        <Controls model={model} />
        <div className={classes.container}>
          <div style={{ display: 'grid' }}>
            <svg className={classes.vtext} width={borderX} height={viewHeight}>
              <g>
                {vview.dynamicBlocks.blocks
                  .filter(region => region.refName)
                  .map(region => {
                    const x = viewHeight - region.offsetPx
                    const y = tickSize
                    return (
                      <text
                        transform={`rotate(${vtextRotation},${x},${y})`}
                        key={region.refName}
                        x={borderX}
                        y={x}
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
              ref={ref}
              onMouseDown={event => {
                if (event.button === 0) {
                  setDown([
                    event.nativeEvent.offsetX,
                    event.nativeEvent.offsetY,
                  ])
                  setCurr([
                    event.nativeEvent.offsetX,
                    event.nativeEvent.offsetY,
                  ])
                }
              }}
            >
              <g>
                {hview.dynamicBlocks.blocks
                  .filter(region => region.refName)
                  .map(region => {
                    return (
                      <line
                        key={JSON.stringify(region)}
                        x1={region.offsetPx + region.widthPx}
                        y1={0}
                        x2={region.offsetPx + region.widthPx}
                        y2={viewHeight}
                        stroke="#000000"
                      />
                    )
                  })}
                {vview.dynamicBlocks.blocks
                  .filter(region => region.refName)
                  .map(region => {
                    const y = viewHeight - (region.offsetPx + region.widthPx)
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
              {down ? (
                <rect
                  fill="rgba(255,0,0,0.3)"
                  x={Math.min(curr[0], down[0])}
                  y={Math.min(curr[1], down[1])}
                  width={Math.abs(curr[0] - down[0])}
                  height={Math.abs(curr[1] - down[1])}
                />
              ) : null}
              {x ? (
                <>
                  <rect
                    fill="rgba(255,0,0)"
                    x={x[0][0]}
                    y={viewHeight - x[0][1]}
                    width={10}
                    height={10}
                  />
                  <rect
                    fill="rgba(255,0,0)"
                    x={x[1][0]}
                    y={viewHeight - x[1][1]}
                    width={10}
                    height={10}
                  />
                </>
              ) : null}
            </svg>
            <div className={classes.spacer} />
            <svg width={viewWidth} height={borderY} className={classes.htext}>
              <g>
                {hview.dynamicBlocks.blocks
                  .filter(region => region.refName)
                  .map(region => {
                    const x = region.offsetPx + 1
                    const y = tickSize
                    return (
                      <text
                        transform={`rotate(${htextRotation},${x},${y})`}
                        key={region.refName}
                        x={x}
                        y={y}
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
          </div>
        </div>
      </div>
    )
  })
  // <DrawLabels model={model} />
  //               <DrawGrid model={model} />
  //
  //               {x ? (
  //                 <>
  //                   <rect
  //                     fill="rgba(255,0,0)"
  //                     x={x[0][0] + borderX}
  //                     y={viewHeight - x[0][1] - borderSize}
  //                     width={10}
  //                     height={10}
  //                   />
  //                   <rect
  //                     fill="rgba(255,0,0)"
  //                     x={x[1][0] + borderX}
  //                     y={viewHeight - x[1][1] - borderSize}
  //                     width={10}
  //                     height={10}
  //                   />
  //                 </>
  //               ) : null}
  DotplotView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return DotplotView
}
