import React, { useState } from 'react'
import { IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import { Menu } from '@jbrowse/core/ui'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'

// locals
import { LinearComparativeViewModel } from '../model'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles()(() => ({
  headerBar: {
    gridArea: '1/1/auto/span 2',
    display: 'flex',
  },
  spacer: {
    flexGrow: 1,
  },
  iconButton: {
    margin: 5,
  },
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  searchContainer: {
    marginLeft: 5,
  },
  searchBox: {
    display: 'flex',
  },
}))

const TrackSelector = observer(({ model }: { model: LCV }) => {
  return (
    <IconButton
      onClick={model.activateTrackSelector}
      title="Open track selector"
    >
      <TrackSelectorIcon />
    </IconButton>
  )
})

const Header = observer(function ({ model }: { model: LCV }) {
  const { classes } = useStyles()
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement>()
  const anyShowHeaders = model.views.some(view => !view.hideHeader)
  return (
    <div className={classes.headerBar}>
      <TrackSelector model={model} />

      <IconButton
        onClick={event => setMenuAnchorEl(event.currentTarget)}
        className={classes.iconButton}
      >
        <MoreVertIcon />
      </IconButton>
      {!anyShowHeaders
        ? model.views.map(view => (
            <div key={view.id} className={classes.searchBox}>
              <div className={classes.searchContainer}>
                <SearchBox model={view} showHelp={false} />
              </div>
              <div className={classes.bp}>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.bp}
                >
                  {Math.round(view.coarseTotalBp).toLocaleString('en-US')} bp
                </Typography>
              </div>
            </div>
          ))
        : null}

      <div className={classes.spacer} />

      {menuAnchorEl ? (
        <Menu
          anchorEl={menuAnchorEl}
          open
          onMenuItemClick={(_event, callback) => {
            callback()
            setMenuAnchorEl(undefined)
          }}
          menuItems={model.headerMenuItems()}
          onClose={() => setMenuAnchorEl(undefined)}
        />
      ) : null}
    </div>
  )
})

export default Header
