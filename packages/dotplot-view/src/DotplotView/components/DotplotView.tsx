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
      hview,
      vview,
      viewingRegionWidth: width,
      viewingRegionHeight: height,
      borderSize,
    } = model
    ctx.strokeRect(borderSize, borderSize, width, height)
    // draw bars going vertically
    const l = (hview.dynamicBlocks.blocks[0] || {}).offsetPx
    hview.dynamicBlocks.forEach(region => {
      if (region.refName) {
        const len = region.widthPx

        ctx.beginPath()
        ctx.moveTo(region.offsetPx - l + len + borderSize, height + borderSize)
        ctx.lineTo(region.offsetPx - l + len + borderSize, borderSize)
        ctx.stroke()
      }
    })
    // draw bars going horizontally
    const t = (vview.dynamicBlocks.blocks[0] || {}).offsetPx
    vview.dynamicBlocks.forEach(region => {
      if (region.refName) {
        const len = region.widthPx

        ctx.beginPath()
        ctx.moveTo(
          width + borderSize,
          height - (region.offsetPx - t + len) + borderSize,
        )
        ctx.lineTo(
          borderSize,
          height - (region.offsetPx - t + len) + borderSize,
        )
        ctx.stroke()
      }
    })
  }

  function DrawLabels(model: DotplotViewModel, ctx: CanvasRenderingContext2D) {
    const { hview, vview, fontSize, height, borderSize } = model
    const l = (hview.dynamicBlocks.blocks[0] || {}).offsetPx
    hview.dynamicBlocks.forEach(region => {
      if (region.refName) {
        const len = region.widthPx
        ctx.fillText(
          region.refName,
          region.offsetPx - l + len / 2,
          height - borderSize + fontSize,
        )
      }
    })

    ctx.save()
    ctx.translate(0, height)
    ctx.rotate(-Math.PI / 2)
    const v = (vview.dynamicBlocks.blocks[0] || {}).offsetPx
    vview.dynamicBlocks.forEach(region => {
      if (region.refName) {
        const len = region.widthPx
        ctx.fillText(
          region.refName,
          region.offsetPx - v + len / 2,
          borderSize - 10,
        )
      }
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
      hview,
      vview,
      width,
      height,
    } = model
    const highlightOverlayCanvas = useRef(null)
    const [down, setDown] = useState()
    const [current, setCurrent] = useState([0, 0])

    // note, the snapshot is needed to force the useEffect canvas re-render
    // because the canvas re-render isn't really an observable component a la
    // mobx-react
    const viewSnap = [getSnapshot(hview), getSnapshot(vview)]

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
    }, [borderSize, fontSize, height, initialized, viewSnap, model, width])

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
              if (down) {
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
                const x1 = model.hview.pxToBp(px1)
                const x2 = model.hview.pxToBp(px2)

                const y1 = model.vview.pxToBp(py1)
                const y2 = model.vview.pxToBp(py2)
                transaction(() => {
                  model.hview.moveTo(x1, x2)
                  model.vview.moveTo(y1, y2)
                })
                setDown(undefined)
              }
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
