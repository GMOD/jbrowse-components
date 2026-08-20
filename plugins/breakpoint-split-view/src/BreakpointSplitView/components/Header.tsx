import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ScrollZoomToggle from '@jbrowse/core/ui/ScrollZoomToggle'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  HeaderSearchBoxRow,
  searchBoxMenuItems,
  useSearchBoxPrefs,
} from '@jbrowse/plugin-linear-genome-view'
import LinkIcon from '@mui/icons-material/Link'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import TuneIcon from '@mui/icons-material/Tune'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { BreakpointViewModel } from '../model.ts'

const useStyles = makeStyles()({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  buttons: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleButton: {
    border: 'none',
  },
})

const Header = observer(function Header({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const prefs = useSearchBoxPrefs('bsv', views.length)
  return (
    <div className={classes.header}>
      <div className={classes.buttons}>
        <CascadingMenuButton
          size="small"
          title="Menu"
          menuItems={() => model.menuItems()}
        >
          <MoreVertIcon />
        </CascadingMenuButton>
        <ScrollZoomToggle model={model} iconOnly />
        <Tooltip title="Link views (sync scroll/zoom across views)">
          <ToggleButton
            value="linkViews"
            selected={model.linkViews}
            onChange={() => {
              model.setLinkViews(!model.linkViews)
            }}
            className={classes.toggleButton}
            size="small"
          >
            <LinkIcon />
          </ToggleButton>
        </Tooltip>
        <CascadingMenuButton
          size="small"
          title="Display settings"
          menuItems={() => searchBoxMenuItems(prefs)}
        >
          <TuneIcon />
        </CascadingMenuButton>
      </div>

      {prefs.showSearchBoxes ? (
        <HeaderSearchBoxRow views={views} sideBySide={prefs.sideBySide} />
      ) : null}
    </div>
  )
})
export default Header
