import React, { useState } from 'react'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  LinearGenomeViewModel,
  SearchBox,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'

// locals
import { LinearComparativeViewModel } from '../model'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { toLocale } from '@jbrowse/core/util'

const useStyles = makeStyles()(() => ({
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
          label: 'Synteny track selectors',
          type: 'subMenu',
          subMenu: model.views.slice(0, -1).map((_, idx) => ({
            label: `Synteny track selector (row ${idx + 1}->${idx + 2})`,
            onClick: () => {
              model.activateTrackSelector(idx)
            },
          })),
        },

        {
          label: 'Row track selectors',
          type: 'subMenu',
          subMenu: model.views.map((view, idx) => ({
            label: `Row ${idx + 1} track selector`,
            onClick: () => view.activateTrackSelector(),
          })),
        },
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
    <div>
      <TrackSelector model={model} />
      <CascadingMenuButton
        className={classes.iconButton}
        menuItems={[
          ...model.headerMenuItems(),
          {
            label: 'Show search boxes?',
            checked: showSearchBoxes,
            type: 'checkbox',
            onClick: () => {
              setShowSearchBoxes(!showSearchBoxes)
            },
          },
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>

      {showSearchBoxes ? (
        <div>
          {views.map(view => (
            <ViewSearchBox key={view.id} view={view} />
          ))}
        </div>
      ) : null}

      <div className={classes.spacer} />
    </div>
  )
})

const ViewSearchBox = observer(function ({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { assemblyNames, coarseTotalBp } = view
  return (
    <div className={classes.searchBox}>
      <SearchBox model={view} showHelp={false} />
      <Typography variant="body2" color="textSecondary" className={classes.bp}>
        {assemblyNames.join(',')} {toLocale(Math.round(coarseTotalBp))} bp
      </Typography>
    </div>
  )
})

export default Header
