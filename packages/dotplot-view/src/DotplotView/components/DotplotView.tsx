/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const { getSnapshot } = jbrequire('mobx-state-tree')
  const { transaction } = jbrequire('mobx')
  const React = jbrequire('react')
  const { useRef, useEffect, useState } = React
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
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

    function onAssemblyChange1(
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) {
      setSelectedAssemblyIdx1(Number(event.target.value))
    }

    function onAssemblyChange2(
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) {
      setSelectedAssemblyIdx2(Number(event.target.value))
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
              onChange={onAssemblyChange1}
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
              onChange={onAssemblyChange2}
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

  function DrawGrid(model: DotplotViewModel, ctx: CanvasRenderingContext2D) {
    const {
      views,
      viewingRegionWidth,
      viewingRegionHeight,
      height,
      borderSize,
    } = model
    ctx.strokeRect(
      borderSize,
      borderSize,
      viewingRegionWidth,
      viewingRegionHeight,
    )
    // draw bars going vertically
    let currWidth = 0
    views[0].displayedRegions.forEach(region => {
      const len = region.end - region.start

      ctx.beginPath()
      ctx.moveTo(
        (currWidth + len) / views[0].bpPerPx + borderSize,
        height - borderSize,
      )
      ctx.lineTo((currWidth + len) / views[0].bpPerPx + borderSize, borderSize)
      ctx.stroke()
      currWidth += len
    })
    // draw bars going horizontally
    let currHeight = 0
    views[1].displayedRegions.forEach(region => {
      const len = region.end - region.start

      ctx.beginPath()
      ctx.moveTo(
        viewingRegionWidth + borderSize,
        viewingRegionHeight -
          (currHeight + len) / views[1].bpPerPx +
          borderSize,
      )
      ctx.lineTo(
        borderSize,
        viewingRegionHeight -
          (currHeight + len) / views[1].bpPerPx +
          borderSize,
      )
      ctx.stroke()
      currHeight += len
    })
  }

  function DrawLabels(model: DotplotViewModel, ctx: CanvasRenderingContext2D) {
    const { views, fontSize, height, borderSize } = model
    let currHeight = 0
    views[0].displayedRegions.forEach(region => {
      const len = region.end - region.start
      ctx.fillText(
        region.refName,
        (currHeight + len / 2) / views[0].bpPerPx,
        height - borderSize + fontSize,
      )

      currHeight += len
    })

    ctx.save()
    ctx.translate(0, height)
    ctx.rotate(-Math.PI / 2)
    let currWidth = 0
    views[1].displayedRegions.forEach(region => {
      const len = region.end - region.start
      ctx.fillText(
        region.refName,
        (currWidth + len / 2) / views[1].bpPerPx + borderSize,
        borderSize - 10,
      )

      currWidth += len
    })
    ctx.restore()
  }

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = useRef()
    const {
      borderSize,
      viewingRegionHeight,
      initialized,
      loading,
      fontSize,
      views,
      width,
      height,
    } = model
    const highlightOverlayCanvas = useRef(null)
    const [down, setDown] = useState()
    const [current, setCurrent] = useState([0, 0])

    // note, the snapshot is needed to force the useEffect canvas re-render
    // because the canvas re-render isn't really an observable component a la
    // mobx-react
    const viewSnap = getSnapshot(views)

    // draw grid
    useEffect(() => {
      if (ref.current) {
        const ctx = ref.current.getContext('2d')
        ctx.clearRect(0, 0, width, height)
        if (initialized) {
          DrawLabels(model, ctx)
          DrawGrid(model, ctx)
        }

        ctx.restore()
      }
    }, [borderSize, fontSize, height, initialized, model, viewSnap, width])

    // allow click and drag over the dotplot view
    useEffect(() => {
      const canvas = highlightOverlayCanvas.current
      if (!canvas) {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const rect = canvas.getBoundingClientRect()
      if (down) {
        ctx.fillStyle = 'rgba(255,0,0,0.3)'
        ctx.fillRect(
          down[0],
          down[1],
          current[0] - down[0],
          current[1] - down[1],
        )
      }
    }, [down, current])

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
          <canvas
            style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}
            ref={highlightOverlayCanvas}
            onMouseDown={event => {
              setDown([event.nativeEvent.offsetX, event.nativeEvent.offsetY])
              setCurrent([event.nativeEvent.offsetX, event.nativeEvent.offsetY])
            }}
            onMouseUp={event => {
              setDown(undefined)
              const curr = [
                event.nativeEvent.offsetX,
                event.nativeEvent.offsetY,
              ]
              const start = down
              let px1 = curr[0] - borderSize
              let px2 = start[0] - borderSize
              if (px1 > px2) {
                ;[px2, px1] = [px1, px2]
              }
              let py1 = viewingRegionHeight - (curr[1] - borderSize)
              let py2 = viewingRegionHeight - (start[1] - borderSize)
              if (py1 > py2) {
                ;[py2, py1] = [py1, py2]
              }
              const x1 = model.views[0].pxToBp(px1)
              const x2 = model.views[0].pxToBp(px2)

              const y1 = model.views[1].pxToBp(py1)
              const y2 = model.views[1].pxToBp(py2)
              transaction(() => {
                model.views[0].moveTo(x1, x2)
                model.views[1].moveTo(y1, y2)
              })
            }}
            onMouseLeave={event => {
              setDown(undefined)
            }}
            onMouseMove={event => {
              setCurrent([event.nativeEvent.offsetX, event.nativeEvent.offsetY])
            }}
            width={width}
            height={height}
          />
          <canvas
            className={classes.content}
            ref={ref}
            width={width}
            height={height}
          />
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
