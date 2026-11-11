import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ScrollZoomToggle from '@jbrowse/core/ui/ScrollZoomToggle'
import ViewMenuButton from '@jbrowse/core/ui/ViewMenuButton'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  HeaderSearchBoxRow,
  searchBoxMenuItems,
  useSearchBoxPrefs,
} from '@jbrowse/plugin-linear-genome-view'
import LinkIcon from '@mui/icons-material/Link'
import TuneIcon from '@mui/icons-material/Tune'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import ConnectionKey from './ConnectionKey.tsx'

import type { BreakpointViewModel } from '../model.ts'

const useStyles = makeStyles()({
  header: {
    display: 'flex',
    flexWrap: 'wrap',
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
        {getSession(model).viewTitleBars === false ? (
          <ViewMenuButton menuItems={() => model.menuItems()} />
        ) : null}
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
      <ConnectionKey model={model} />
    </div>
  )
})
export default Header
