/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import { useRef as reactUseRef } from 'react'

import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef, useEffect, useCallback, useState } = React
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles: jbMakeStyles } = jbrequire('@material-ui/core/styles')
  const Container = jbrequire('@material-ui/core/Container')
  const Grid = jbrequire('@material-ui/core/Grid')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const Button = jbrequire('@material-ui/core/Button')
  const TextField = jbrequire('@material-ui/core/TextField')
  const LinearProgress = jbrequire('@material-ui/core/LinearProgress')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
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
        position: 'relative',
      },
      overlay: {
        pointerEvents: 'none',
        display: 'flex',
        width: '100%',
        gridArea: '1/1',
        zIndex: 100,
        '& path': {
          cursor: 'crosshair',
          fill: 'none',
        },
      },
      content: {
        gridArea: '1/1',
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
      importFormContainer: {
        marginBottom: theme.spacing(4),
      },
      importFormEntry: {
        minWidth: 180,
      },
      errorMessage: {
        textAlign: 'center',
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1),
      },
      iconButton: {
        padding: '4px',
        margin: '0 2px 0 2px',
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

  const ImportForm = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const [selectedAssemblyIdx1, setSelectedAssemblyIdx1] = useState(0)
    const [selectedAssemblyIdx2, setSelectedAssemblyIdx2] = useState(0)
    const [error, setError] = useState('')
    const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
    if (!assemblyNames.length) {
      setError('No configured assemblies')
    }

    function onOpenClick() {
      model.setViews([
        { bpPerPx: 0.1, offsetPx: 0 },
        { bpPerPx: 0.1, offsetPx: 0 },
      ])
      model.setAssemblyNames([
        assemblyNames[selectedAssemblyIdx1],
        assemblyNames[selectedAssemblyIdx2],
      ])
    }

    return (
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <TextField
              select
              variant="outlined"
              value={
                assemblyNames[selectedAssemblyIdx1] && !error
                  ? selectedAssemblyIdx1
                  : ''
              }
              onChange={(
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => {
                setSelectedAssemblyIdx1(Number(event.target.value))
              }}
              label="Assembly"
              helperText={error || 'Select assembly to view'}
              error={!!error}
              disabled={!!error}
              margin="normal"
              className={classes.importFormEntry}
            >
              {assemblyNames.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            <TextField
              select
              variant="outlined"
              value={
                assemblyNames[selectedAssemblyIdx2] && !error
                  ? selectedAssemblyIdx2
                  : ''
              }
              onChange={(
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => {
                setSelectedAssemblyIdx2(Number(event.target.value))
              }}
              label="Assembly"
              helperText={error || 'Select assembly to view'}
              error={!!error}
              disabled={!!error}
              margin="normal"
              className={classes.importFormEntry}
            >
              {assemblyNames.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            <Button onClick={onOpenClick} variant="contained" color="primary">
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    )
  })

  const DrawGrid = observer((props: { model: DotplotViewModel }) => {
    const { model } = props
    const { hview, vview, viewWidth, viewHeight, borderSize, borderX } = model
    const l = (hview.dynamicBlocks.blocks[0] || {}).offsetPx || 0
    const v = (vview.dynamicBlocks.blocks[0] || {}).offsetPx || 0
    return (
      <g transform={`translate(${borderX},${borderSize})`}>
        {hview.dynamicBlocks.blocks
          .filter(region => region.refName)
          .map(region => {
            const x = region.offsetPx - l + region.widthPx
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
            const y = viewHeight - (region.offsetPx - v + region.widthPx)
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
    )
  })

  const DrawLabels = observer((props: { model: DotplotViewModel }) => {
    const { model } = props
    const {
      hview,
      vview,
      borderX,
      viewHeight,
      vtextRotation,
      htextRotation,
      borderSize,
      tickSize,
    } = model
    const l = (hview.dynamicBlocks.blocks[0] || {}).offsetPx || 0
    const v = (vview.dynamicBlocks.blocks[0] || {}).offsetPx || 0
    return (
      <>
        <g transform={`translate(${borderX},${borderSize + viewHeight})`}>
          {hview.dynamicBlocks.blocks
            .filter(region => region.refName)
            .map(region => {
              const x = region.offsetPx - l
              const y = tickSize
              return (
                <text
                  transform={`rotate(${htextRotation},${x},${y})`}
                  key={region.refName}
                  x={x}
                  y={y}
                  fill="#000000"
                  dominantBaseline="middle"
                  textAnchor="end"
                >
                  {region.refName}
                </text>
              )
            })}
        </g>

        <g transform={`translate(0,${borderSize})`}>
          {vview.dynamicBlocks.blocks
            .filter(region => region.refName)
            .map(region => {
              const x = borderX - tickSize
              const y = viewHeight - (region.offsetPx - v)
              return (
                <text
                  transform={`rotate(${vtextRotation},${x},${y})`}
                  key={region.refName}
                  x={x}
                  y={y}
                  fill="#000000"
                  dominantBaseline="middle"
                  textAnchor="end"
                >
                  {region.refName}
                </text>
              )
            })}
        </g>
      </>
    )
  })

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const prevX = (useRef as typeof reactUseRef)<number | null>(null)
    const prevY = (useRef as typeof reactUseRef)<number | null>(null)
    const scheduled = (useRef as typeof reactUseRef)(false)
    const [mouseDragging, setMouseDragging] = useState(false)

    const { initialized, loading, width, height } = model

    const wheel = useCallback(
      (event: WheelEvent) => {
        const { deltaY } = event
        const { offsetX, offsetY } = event
        const height = event.target ? event.target.clientHeight : 0
        const factor = 1 + deltaY / 500
        model.vview.zoomTo(model.vview.bpPerPx * factor, height - offsetY)
        model.hview.zoomTo(model.hview.bpPerPx * factor, offsetX)
        event.preventDefault()
      },
      [model.hview, model.vview],
    )

    const setRef = useCallback(
      (currRef: SVGElement) => {
        if (currRef) {
          currRef.addEventListener('wheel', wheel, { passive: false })
        }
      },
      [wheel],
    )

    useEffect(() => {
      let cleanup = () => {}

      function globalMouseMove(event: MouseEvent) {
        event.preventDefault()
        const xdistance =
          prevX.current !== null ? event.clientX - prevX.current : event.clientX
        const ydistance =
          prevY.current !== null ? event.clientY - prevY.current : event.clientY
        // use rAF to make it so multiple event handlers aren't fired per-frame
        // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
        if (!scheduled.current) {
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.hview.horizontalScroll(-xdistance)
            model.vview.horizontalScroll(ydistance)
            scheduled.current = false
            prevX.current = event.clientX
            prevY.current = event.clientY
          })
        }
      }

      function globalMouseUp() {
        prevX.current = null
        prevY.current = null
        if (mouseDragging) {
          setMouseDragging(false)
        }
      }

      if (mouseDragging) {
        window.addEventListener('mousemove', globalMouseMove, true)
        window.addEventListener('mouseup', globalMouseUp, true)
        cleanup = () => {
          window.removeEventListener('mousemove', globalMouseMove, true)
          window.removeEventListener('mouseup', globalMouseUp, true)
        }
      }
      return cleanup
    }, [model, mouseDragging, prevX, prevY, scheduled])

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

    return (
      <div style={{ position: 'relative' }}>
        <Controls model={model} />
        <div className={classes.container}>
          <svg
            className={classes.content}
            width={width}
            height={height}
            ref={setRef}
            onMouseDown={event => {
              if (event.button === 0) {
                prevX.current = event.clientX
                prevY.current = event.clientY
                setMouseDragging(true)
              }
            }}
          >
            <DrawLabels model={model} />
            <DrawGrid model={model} />
          </svg>

          <div className={classes.overlay}>
            {model.tracks.map((track: any) => {
              const { ReactComponent } = track

              return ReactComponent ? (
                <ReactComponent key={getConf(track, 'trackId')} model={track} />
              ) : null
            })}
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
