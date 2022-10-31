import React, { lazy, useState } from 'react'
import { Alert, Button, IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'

// icons
import ZoomOut from '@mui/icons-material/ZoomOut'
import ZoomIn from '@mui/icons-material/ZoomIn'
import MoreVert from '@mui/icons-material/MoreVert'
import { CursorMouse, CursorMove } from './CursorIcon'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { DotplotViewModel } from '../model'

// lazy components
const WarningDialog = lazy(() => import('./WarningDialog'))

const useStyles = makeStyles()({
  iconButton: {
    margin: 5,
  },
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  spacer: {
    flexGrow: 1,
  },
  headerBar: {
    display: 'flex',
  },
})

const DotplotControls = observer(({ model }: { model: DotplotViewModel }) => {
  const { classes } = useStyles()
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement>()
  return (
    <div>
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

      <IconButton
        onClick={model.activateTrackSelector}
        className={classes.iconButton}
        title="Open track selector"
        data-testid="circular_track_select"
        color="secondary"
      >
        <TrackSelectorIcon />
      </IconButton>

      <IconButton
        onClick={event => setMenuAnchorEl(event.currentTarget)}
        className={classes.iconButton}
        color="secondary"
      >
        <MoreVert />
      </IconButton>

      {menuAnchorEl ? (
        <Menu
          anchorEl={menuAnchorEl}
          open
          onMenuItemClick={(_event, callback) => {
            callback()
            setMenuAnchorEl(undefined)
          }}
          menuItems={[
            {
              onClick: () => model.squareView(),
              label: 'Square view - same base pairs per pixel',
            },
            {
              onClick: () => model.squareViewProportional(),
              label: 'Rectanglular view - same total bp',
            },
            {
              onClick: () => model.setDrawCigar(!model.drawCigar),
              type: 'checkbox',
              label: 'Draw CIGAR',
              checked: model.drawCigar,
            },
            {
              onClick: () => model.setCursorMode('move'),
              label: 'Cursor mode - click and drag to move',
              icon: CursorMove,
              type: 'radio',
              checked: model.cursorMode === 'move',
            },
            {
              onClick: () => model.setCursorMode('crosshair'),
              label: 'Cursor mode - select region',
              icon: CursorMouse,
              type: 'radio',
              checked: model.cursorMode === 'crosshair',
            },
          ]}
          onClose={() => setMenuAnchorEl(undefined)}
        />
      ) : null}
    </div>
  )
})
const Warnings = observer(({ model }: { model: DotplotViewModel }) => {
  const tracksWithWarnings = model.tracks.filter(
    t => t.displays[0].warnings?.length,
  )
  const [shown, setShown] = useState(false)
  return tracksWithWarnings.length ? (
    <Alert severity="warning">
      Warnings during render{' '}
      <Button onClick={() => setShown(true)}>More info</Button>
      {shown ? (
        <WarningDialog
          tracksWithWarnings={tracksWithWarnings}
          handleClose={() => setShown(false)}
        />
      ) : null}
    </Alert>
  ) : null
})

const Header = observer(
  ({
    model,
    selection,
  }: {
    model: DotplotViewModel
    selection?: { width: number; height: number }
  }) => {
    const { classes } = useStyles()
    const { hview, vview } = model
    return (
      <div className={classes.headerBar}>
        <DotplotControls model={model} />
        <Typography
          className={classes.bp}
          variant="body2"
          color="textSecondary"
        >
          x: {hview.assemblyNames.join(',')} {getBpDisplayStr(hview.currBp)}
          <br />
          y: {vview.assemblyNames.join(',')} {getBpDisplayStr(vview.currBp)}
        </Typography>
        {selection ? (
          <Typography
            className={classes.bp}
            variant="body2"
            color="textSecondary"
          >
            {`width:${getBpDisplayStr(hview.bpPerPx * selection.width)}`} <br />
            {`height:${getBpDisplayStr(vview.bpPerPx * selection.height)}`}
          </Typography>
        ) : null}
        <div className={classes.spacer} />
        <Warnings model={model} />
      </div>
    )
  },
)
export default Header
