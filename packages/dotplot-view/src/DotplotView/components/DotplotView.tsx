/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
// @ts-ignore
import { Text, Surface, Shape, Path, Transform, Group } from 'react-art'

import { DotplotViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef, useState } = React
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

  const DrawGrid = observer((props: { model: DotplotViewModel }) => {
    const { model } = props
    const {
      hview,
      vview,
      viewingRegionWidth: width,
      viewingRegionHeight: height,
      borderSize,
    } = model
    const l = (hview.dynamicBlocks.blocks[0] || {}).offsetPx
    const v = (vview.dynamicBlocks.blocks[0] || {}).offsetPx
    return (
      <>
        <Group x={borderSize} y={borderSize}>
          {hview.dynamicBlocks.blocks
            .filter(region => region.refName)
            .map(region => {
              const x = region.offsetPx - l + region.widthPx
              return (
                <Shape
                  d={new Path().moveTo(x, 0).lineTo(x, height)}
                  stroke="#000000"
                />
              )
            })}
          <Shape
            d={new Path().moveTo(0, height).lineTo(0, 0)}
            stroke="#000000"
          />
          {vview.dynamicBlocks.blocks
            .filter(region => region.refName)
            .map(region => {
              const y = height - (region.offsetPx - v + region.widthPx)
              return (
                <Shape
                  d={new Path().moveTo(0, y).lineTo(width, y)}
                  stroke="#000000"
                />
              )
            })}
          <Shape
            d={new Path().moveTo(0, height).lineTo(width, height)}
            stroke="#000000"
          />
        </Group>
      </>
    )
  })

  const DotplotView = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const ref = useRef()
    const { initialized, loading, fontSize, width, height } = model
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
          <Surface width={width} height={height}>
            <DrawLabels model={model} />
            <DrawGrid model={model} />
          </Surface>
        </div>
      </div>
    )
  })

  const DrawLabels = observer((props: { model: DotplotViewModel }) => {
    const { model } = props
    const {
      hview,
      vview,
      viewingRegionHeight,
      fontSize,
      height,
      borderSize,
    } = model
    const l = (hview.dynamicBlocks.blocks[0] || {}).offsetPx
    const v = (vview.dynamicBlocks.blocks[0] || {}).offsetPx
    return (
      <>
        <Group>
          {hview.dynamicBlocks.blocks
            .filter(region => region.refName)
            .map(region => {
              const len = region.widthPx
              const x = region.offsetPx - l + len / 2
              const y = height - borderSize + fontSize
              return (
                <Text
                  key={region.refName}
                  x={x}
                  y={y - 13}
                  font={`13px "Helvetica Neue", "Helvetica", Arial`}
                  fill="#000000"
                >
                  {region.refName}
                </Text>
              )
            })}
        </Group>

        <Group>
          {vview.dynamicBlocks.blocks
            .filter(region => region.refName)
            .map(region => {
              console.log(region.refName)
              const len = region.widthPx
              const x = borderSize
              const y = viewingRegionHeight - region.offsetPx - v + len / 2
              return (
                <Text
                  transform={new Transform().rotate(-25)}
                  key={region.refName}
                  x={x}
                  y={y - 13}
                  font={`13px "Helvetica Neue", "Helvetica", Arial`}
                  fill="#000000"
                >
                  {region.refName}
                </Text>
              )
            })}
        </Group>
      </>
    )

    //       ctx.save()
    //       ctx.translate(0, height)
    //       ctx.rotate(-Math.PI / 2)
    //       const v = (vview.dynamicBlocks.blocks[0] || {}).offsetPx
    //       vview.dynamicBlocks.forEach(region => {
    //         if (region.refName) {
    //           const len = region.widthPx
    //           ctx.fillText(
    //             region.refName,
    //             region.offsetPx - v + len / 2,
    //             borderSize - 10,
    //           )
    //         }
    //       })
    //       ctx.restore()
  })

  // {initialized ? <DrawLabels model={model} forwardRef={ref} /> : null}
  // {initialized ? <DrawGrid model={model} forwardRef={ref} /> : null}
  // <div className={classes.overlay}>
  //   {model.tracks.map((track: any) => {
  //     const { ReactComponent } = track

  //     return ReactComponent ? (
  //       <ReactComponent key={getConf(track, 'trackId')} model={track} />
  //     ) : null
  //   })}
  // </div>
  // <canvas
  //   style={{ position: 'absolute', left: 0, top: 0, zIndex: 10 }}
  //   ref={highlightOverlayCanvas}
  //   onMouseDown={event => {
  //     setDown([event.nativeEvent.offsetX, event.nativeEvent.offsetY])
  //     setCurrent([event.nativeEvent.offsetX, event.nativeEvent.offsetY])
  //   }}
  //   onMouseUp={event => {
  //     if (down) {
  //       const curr = [
  //         event.nativeEvent.offsetX,
  //         event.nativeEvent.offsetY,
  //       ]
  //       const start = down
  //       let px1 = curr[0] - borderSize
  //       let px2 = start[0] - borderSize
  //       if (px1 > px2) {
  //         ;[px2, px1] = [px1, px2]
  //       }
  //       let py1 = viewingRegionHeight - (curr[1] - borderSize)
  //       let py2 = viewingRegionHeight - (start[1] - borderSize)
  //       if (py1 > py2) {
  //         ;[py2, py1] = [py1, py2]
  //       }
  //       const x1 = model.hview.pxToBp(px1)
  //       const x2 = model.hview.pxToBp(px2)

  //       const y1 = model.vview.pxToBp(py1)
  //       const y2 = model.vview.pxToBp(py2)
  //       transaction(() => {
  //         model.hview.moveTo(x1, x2)
  //         model.vview.moveTo(y1, y2)
  //       })
  //       setDown(undefined)
  //     }
  //   }}
  //   onMouseLeave={event => {
  //     setDown(undefined)
  //   }}
  //   onMouseMove={event => {
  //     setCurrent([event.nativeEvent.offsetX, event.nativeEvent.offsetY])
  //   }}
  //   width={width}
  //   height={height}
  // />
  DotplotView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return DotplotView
}
