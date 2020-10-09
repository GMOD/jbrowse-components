import React from 'react'

import { makeStyles } from '@material-ui/core/styles'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ArrowUp from '@material-ui/icons/KeyboardArrowUp'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft'
import ArrowRight from '@material-ui/icons/KeyboardArrowRight'
import TrackSelectorIcon from '@material-ui/icons/LineStyle'
import IconButton from '@material-ui/core/IconButton'
import ToggleButton from '@material-ui/lab/ToggleButton'

import { observer } from 'mobx-react'
import { isSessionModelWithWidgets, getSession } from '@jbrowse/core/util'
import { DotplotViewModel } from '../model'

export default () => {
  const useStyles = makeStyles({
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
      zIndex: 1001, // needs to be above overlay but below things that might naturally go on top of it like a context menu from jbrowse-core/ui
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
          <ArrowLeft />
        </IconButton>

        <IconButton
          onClick={() => {
            model.hview.scroll(100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowRight />
        </IconButton>
        <IconButton
          onClick={() => {
            model.vview.scroll(100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowDown />
        </IconButton>
        <IconButton
          onClick={() => {
            model.vview.scroll(-100)
          }}
          className={classes.iconButton}
          title="left"
          color="secondary"
        >
          <ArrowUp />
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
            isSessionModelWithWidgets(session) &&
            session.visibleWidget &&
            session.visibleWidget.id === 'hierarchicalTrackSelector' &&
            // @ts-ignore
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
