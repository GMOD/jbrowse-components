import { makeStyles as makeStylesMUI } from '@material-ui/core/styles'
import { DotplotViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')

  const useStyles = (makeStyles as typeof makeStylesMUI)({
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
      zIndex: 10000, // needs to be above overlay
    },
  })

  const Controls = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const session = getSession(model)
    return (
      <div className={classes.controls}>
        <IconButton
          onClick={() => {
            model.hview.horizontalScroll(-100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <Icon fontSize="small">keyboard_arrow_left</Icon>
        </IconButton>

        <IconButton
          onClick={() => {
            model.hview.horizontalScroll(100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <Icon fontSize="small">keyboard_arrow_right</Icon>
        </IconButton>
        <IconButton
          onClick={() => {
            model.vview.horizontalScroll(100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <Icon fontSize="small">keyboard_arrow_down</Icon>
        </IconButton>
        <IconButton
          onClick={() => {
            model.vview.horizontalScroll(-100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <Icon fontSize="small">keyboard_arrow_up</Icon>
        </IconButton>
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
  return Controls
}
