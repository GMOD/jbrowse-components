import React, { useState } from 'react'

import { IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'

// icons
import ZoomOut from '@mui/icons-material/ZoomOut'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ArrowUp from '@mui/icons-material/KeyboardArrowUp'
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'
import ArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import ArrowRight from '@mui/icons-material/KeyboardArrowRight'
import CropFreeIcon from '@mui/icons-material/CropFree'

import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

import { observer } from 'mobx-react'
import { DotplotViewModel } from '../model'

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
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  return (
    <div>
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
        title="Square view"
        color="secondary"
      >
        <CropFreeIcon />
      </IconButton>

      {menuAnchorEl ? (
        <Menu
          anchorEl={menuAnchorEl}
          keepMounted
          open={Boolean(menuAnchorEl)}
          onMenuItemClick={(_event, callback) => {
            callback()
            setMenuAnchorEl(null)
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
          ]}
          onClose={() => {
            setMenuAnchorEl(null)
          }}
        />
      ) : null}
    </div>
  )
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
      </div>
    )
  },
)
export default Header
