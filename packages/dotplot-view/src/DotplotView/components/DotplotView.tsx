/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import { useRef as reactUseRef } from 'react'
import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef, useEffect, useState } = React
  const { minmax,useEventListener } = jbrequire('@gmod/jbrowse-core/util')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles: jbMakeStyles } = jbrequire('@material-ui/core/styles')
  const LinearProgress = jbrequire('@material-ui/core/LinearProgress')
  const ImportForm = jbrequire(require('./ImportForm'))
  const Controls = jbrequire(require('./Controls'))

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

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = (useRef as typeof reactUseRef)<SVGSVGElement | null>(null)
    const [curr, setCurr] = useState()
    const [down, setDown] = useState()

    function wheel(event: WheelEvent) {
      model.hview.horizontalScroll(event.deltaX)
      model.vview.horizontalScroll(event.deltaY)
      event.preventDefault()
    }

    useEventListener('wheel', wheel, ref.current)

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
          if (Math.abs(xmax - xmin) > 3 && Math.abs(ymax - ymin) > 3) {
            const x1 = model.hview.pxToBp(xmin)
            const x2 = model.hview.pxToBp(xmax)

            const y1 = model.vview.pxToBp(viewHeight - ymin)
            const y2 = model.vview.pxToBp(viewHeight - ymax)

            model.hview.moveTo(x1, x2)
            model.vview.moveTo(y2, y1)
          }
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
                    const y = viewHeight - (region.offsetPx - vview.offsetPx)
                    const x = borderX
                    return (
                      <text
                        transform={`rotate(${vtextRotation},${x},${y})`}
                        key={JSON.stringify(region)}
                        x={borderX}
                        y={y}
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
              {down ? (
                <rect
                  fill="rgba(255,0,0,0.3)"
                  x={Math.min(curr[0], down[0])}
                  y={Math.min(curr[1], down[1])}
                  width={Math.abs(curr[0] - down[0])}
                  height={Math.abs(curr[1] - down[1])}
                />
              ) : null}
            </svg>
            <div className={classes.spacer} />
            <svg width={viewWidth} height={borderY} className={classes.htext}>
              <g>
                {hview.dynamicBlocks.blocks
                  .filter(region => region.refName)
                  .map(region => {
                    const x = region.offsetPx - hview.offsetPx
                    const y = tickSize
                    return (
                      <text
                        transform={`rotate(${htextRotation},${x},${y})`}
                        key={region.refName}
                        x={x}
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
          </div>
        </div>
      </div>
    )
  })

  DotplotView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return DotplotView
}
