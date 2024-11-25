import React, { useState } from 'react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import { FormGroup } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import HeaderSearchBoxes from './HeaderSearchBoxes'
import type { LinearComparativeViewModel } from '../model'

const useStyles = makeStyles()({
  inline: {
    display: 'inline-flex',
  },
})

const Header = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const [showSearchBoxes, setShowSearchBoxes] = useState(views.length <= 3)
  const [sideBySide, setSideBySide] = useState(views.length <= 3)
  return (
    <FormGroup row>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Synteny track selectors',
            type: 'subMenu',
            subMenu: views.slice(0, -1).map((_, idx) => ({
              label: `Row ${idx + 1}->${idx + 2} (${views[idx]!.assemblyNames.join(',')}->${views[idx + 1]!.assemblyNames.join(',')})`,
              onClick: () => {
                model.activateTrackSelector(idx)
              },
            })),
          },

          {
            label: 'Row track selectors',
            type: 'subMenu',
            subMenu: views.map((view, idx) => ({
              label: `Row ${idx + 1} track selector (${view.assemblyNames.join(',')})`,
              onClick: () => view.activateTrackSelector(),
            })),
          },
        ]}
      >
        <TrackSelectorIcon />
      </CascadingMenuButton>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Row view menus',
            type: 'subMenu',
            subMenu: views.map((view, idx) => ({
              label: `View ${idx + 1} Menu`,
              subMenu: view.menuItems(),
            })),
          },
          ...model.headerMenuItems(),
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Show search boxes',
            type: 'checkbox',
            checked: showSearchBoxes,
            onClick: () => {
              setShowSearchBoxes(!showSearchBoxes)
            },
          },

          {
            label: 'Orientation - Side-by-side',
            type: 'radio',
            checked: sideBySide,
            onClick: () => {
              setSideBySide(!sideBySide)
            },
          },
          {
            label: 'Orientation - Vertical',
            type: 'radio',
            checked: !sideBySide,
            onClick: () => {
              setSideBySide(!sideBySide)
            },
          },
        ]}
      >
        <SearchIcon />
      </CascadingMenuButton>

      {showSearchBoxes ? (
        <span className={sideBySide ? classes.inline : undefined}>
          {views.map(view => (
            <HeaderSearchBoxes key={view.id} view={view} />
          ))}
        </span>
      ) : null}
    </FormGroup>
  )
})
export default Header
