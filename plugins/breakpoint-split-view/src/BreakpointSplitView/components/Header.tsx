import { useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import { FormGroup } from '@mui/material'
import { observer } from 'mobx-react'

import HeaderSearchBoxes from './HeaderSearchBoxes'

import type { BreakpointViewModel } from '../model'

const useStyles = makeStyles()({
  inline: {
    display: 'inline-flex',
  },
})

const Header = observer(function Header({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const [showSearchBoxes, setShowSearchBoxes] = useState(views.length <= 3)
  const [sideBySide, setSideBySide] = useState(views.length <= 3)
  return (
    <FormGroup row>
      <CascadingMenuButton menuItems={() => model.menuItems()}>
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
