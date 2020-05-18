import { makeStyles as muiMakeStyles } from '@material-ui/core/styles'
import { useRef as reactUseRef, useState as reactUseState } from 'react'
import { Menu as CoreMenu } from '@gmod/jbrowse-core/ui'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { DotplotViewModel } from '../model'

type UI = { Menu: typeof CoreMenu }

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef, useState } = React
  const { useEventListener } = jbrequire('@gmod/jbrowse-core/util')
  const { Menu } = jbrequire('@gmod/jbrowse-core/ui') as UI
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const LinearProgress = jbrequire('@material-ui/core/LinearProgress')
  const ImportForm = jbrequire(require('./ImportForm'))
  const Controls = jbrequire(require('./Controls'))

  type useRefR = typeof reactUseRef
  type useStateR = typeof reactUseState
  type makeStylesR = typeof muiMakeStyles

  const useStyles = (makeStyles as makeStylesR)(theme => {
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

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = (useRef as useRefR)<SVGSVGElement | null>(null)
    const [mousecurr, setMouseCurr] = (useState as useStateR)([0, 0])
    const [mousedown, setMouseDown] = (useState as useStateR)<Coord>()
    const [mouseup, setMouseUp] = (useState as useStateR)<Coord>()
    const [tracking, setTracking] = useState(false)

    useEventListener(
      'wheel',
      (event: WheelEvent) => {
        model.hview.horizontalScroll(event.deltaX)
        model.vview.horizontalScroll(-event.deltaY)
        event.preventDefault()
      },
      ref.current,
    )

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

    useEventListener(
      'mousemove',
      (event: MouseEvent) => {
        if (tracking) {
          setMouseCurr([event.offsetX, event.offsetY])
        }
      },
      ref.current,
    )
    useEventListener(
      'mouseup',
      (event: MouseEvent) => {
        if (mousedown) {
          setMouseUp([event.offsetX, event.offsetY])
          setTracking(false)
        }
      },
      ref.current,
    )

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
                    model.zoomIn(mousedown, mouseup)
                  },
                },
                {
                  label: 'Open linear synteny view',
                  onClick: () => {
                    model.onDotplotView(mousedown, mouseup)
                  },
                },
              ]}
            />
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
