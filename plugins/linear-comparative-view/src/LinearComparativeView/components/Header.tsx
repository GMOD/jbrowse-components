import React, { useState } from 'react'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'

// locals
import { LinearComparativeViewModel } from '../model'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

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

const TrackSelector = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Synteny track selector',
          onClick: () => model.activateTrackSelector(),
        },
        ...model.views.map((view, idx) => ({
          label: `View ${idx + 1} track selector`,
          onClick: () => view.activateTrackSelector(),
        })),
      ]}
    >
      <TrackSelectorIcon />
    </CascadingMenuButton>
  )
})

const Header = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const [showSearchBoxes, setShowSearchBoxes] = useState(false)
  return (
    <div className={classes.headerBar}>
      <TrackSelector model={model} />
      <CascadingMenuButton
        className={classes.iconButton}
        menuItems={[
          ...model.headerMenuItems(),
          {
            label: 'Show search boxes?',
            checked: showSearchBoxes,
            onClick: () => {
              setShowSearchBoxes(!showSearchBoxes)
            },
            type: 'checkbox',
          },
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>

      {showSearchBoxes ? (
        <div>
          {views.map(view => (
            <div key={view.id} className={classes.searchBox}>
              <div className={classes.searchContainer}>
                <SearchBox model={view} showHelp={false} />
              </div>
              <Typography
                variant="body2"
                color="textSecondary"
                className={classes.bp}
              >
                {view.assemblyNames.join(',')}{' '}
                {Math.round(view.coarseTotalBp).toLocaleString('en-US')} bp
              </Typography>
            </div>
          ))}
        </div>
      ) : null}

      <div className={classes.spacer} />
    </div>
  )
})

export default Header
