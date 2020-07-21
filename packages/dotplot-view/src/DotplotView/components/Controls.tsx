import { makeStyles as makeStylesMUI } from '@material-ui/core/styles'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ArrowUp from '@material-ui/icons/KeyboardArrowUp'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft'
import ArrowRight from '@material-ui/icons/KeyboardArrowRight'
import TrackSelectorIcon from '@material-ui/icons/LineStyle'
import { DotplotViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
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
            model.hview.scroll(-100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowLeft fontSize="small" />
        </IconButton>

        <IconButton
          onClick={() => {
            model.hview.scroll(100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowRight fontSize="small" />
        </IconButton>
        <IconButton
          onClick={() => {
            model.vview.scroll(100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowDown fontSize="small" />
        </IconButton>
        <IconButton
          onClick={() => {
            model.vview.scroll(-100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowUp fontSize="small" />
        </IconButton>
        <IconButton
          onClick={model.zoomOutButton}
          className={classes.iconButton}
          color="secondary"
        >
          <ZoomOut />
        </IconButton>

        <IconButton
          onClick={model.zoomInButton}
          className={classes.iconButton}
          title="zoom in"
          color="secondary"
        >
          <ZoomIn />
        </IconButton>

        <ToggleButton
          onClick={model.activateTrackSelector}
          title="select tracks"
          selected={
            session.visibleWidget &&
            session.visibleWidget.id === 'hierarchicalTrackSelector' &&
            session.visibleWidget.view.id === model.id
          }
          value="track_select"
          data-testid="circular_track_select"
          color="secondary"
        >
          <TrackSelectorIcon />
        </ToggleButton>
      </div>
    )
  })
  return Controls
}
