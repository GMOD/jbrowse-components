import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { FormGroup } from '@mui/material'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { LinearComparativeViewModel } from '../model'
import HeaderSearchBoxes from './HeaderSearchBoxes'

const Header = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { views } = model
  const [showSearchBoxes, setShowSearchBoxes] = useState(true)
  const [sideBySide, setSideBySide] = useState(true)
  return (
    <FormGroup row>
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
        <span style={{ display: sideBySide ? 'inline-flex' : undefined }}>
          {views.map(view => (
            <HeaderSearchBoxes key={view.id} view={view} />
          ))}
        </span>
      ) : null}
    </FormGroup>
  )
})
export default Header
