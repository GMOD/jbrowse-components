import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { LinearComparativeViewModel } from '../model'
import HeaderSearchBoxes from './HeaderSearchBoxes'

const useStyles = makeStyles()(() => ({
  spacer: {
    flexGrow: 1,
  },
  iconButton: {
    margin: 5,
  },
}))

const TrackSelector = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { views } = model
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Synteny track selectors',
          type: 'subMenu',
          subMenu: views.slice(0, -1).map((_, idx) => ({
            label: `Synteny track selector (row ${idx + 1}->${idx + 2})`,
            onClick: () => {
              model.activateTrackSelector(idx)
            },
          })),
        },

        {
          label: 'Row track selectors',
          type: 'subMenu',
          subMenu: views.map((view, idx) => ({
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
          {
            label: 'Row view menus',
            type: 'subMenu',
            subMenu: views.map((view, idx) => ({
              label: `View ${idx + 1} Menu`,
              subMenu: view.menuItems(),
            })),
          },
          {
            label: 'Show search boxes?',
            checked: showSearchBoxes,
            type: 'checkbox',
            onClick: () => {
              setShowSearchBoxes(!showSearchBoxes)
            },
          },
          ...model.headerMenuItems(),
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>

      {showSearchBoxes ? (
        <div>
          {views.map(view => (
            <HeaderSearchBoxes key={view.id} view={view} />
          ))}
        </div>
      ) : null}

      <div className={classes.spacer} />
    </div>
  )
})

export default Header
