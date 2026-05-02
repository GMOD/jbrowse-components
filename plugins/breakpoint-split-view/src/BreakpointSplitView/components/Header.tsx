import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import LinkIcon from '@mui/icons-material/Link'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import TuneIcon from '@mui/icons-material/Tune'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { ToggleButton } from '@mui/material'
import { observer } from 'mobx-react'

import HeaderSearchBoxes from './HeaderSearchBoxes.tsx'

import type { BreakpointViewModel } from '../model.ts'

const useStyles = makeStyles()({
  header: {
    display: 'flex',
    alignItems: 'center',
  },
  buttons: {
    display: 'flex',
    alignItems: 'center',
  },
  inline: {
    display: 'inline-flex',
  },
  vertical: {
    display: 'flex',
    flexDirection: 'column',
  },
})

const ScrollZoomButton = observer(function ScrollZoomButton({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { views } = model
  const allScrollZoom = views.every(v => v.scrollZoom)
  return (
    <ToggleButton
      value="scrollZoom"
      selected={allScrollZoom}
      onChange={() => {
        for (const view of views) {
          view.setScrollZoom(!allScrollZoom)
        }
      }}
      title="Toggle scroll zoom on WebGL tracks"
      sx={{ border: 'none' }}
      size="small"
    >
      <ZoomInMapIcon />
    </ToggleButton>
  )
})

const LinkViewsButton = observer(function LinkViewsButton({
  model,
}: {
  model: BreakpointViewModel
}) {
  return (
    <ToggleButton
      value="linkViews"
      selected={model.linkViews}
      onChange={() => {
        model.setLinkViews(!model.linkViews)
      }}
      title="Link views (sync scroll/zoom across views)"
      sx={{ border: 'none' }}
      size="small"
    >
      <LinkIcon />
    </ToggleButton>
  )
})

const Header = observer(function Header({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    'bsv-showSearchBoxes',
    views.length <= 3,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    'bsv-sideBySide',
    views.length <= 3,
  )
  return (
    <div className={classes.header}>
      <div className={classes.buttons}>
        {model.initialized ? (
          <CascadingMenuButton
            size="small"
            title="Menu"
            menuItems={() => model.menuItems()}
          >
            <MoreVertIcon />
          </CascadingMenuButton>
        ) : null}
        <ScrollZoomButton model={model} />
        <LinkViewsButton model={model} />
        <CascadingMenuButton
          size="small"
          title="Display settings"
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
              label: 'Search boxes - side-by-side',
              type: 'radio',
              checked: sideBySide,
              onClick: () => {
                setSideBySide(true)
              },
            },
            {
              label: 'Search boxes - stacked',
              type: 'radio',
              checked: !sideBySide,
              onClick: () => {
                setSideBySide(false)
              },
            },
          ]}
        >
          <TuneIcon />
        </CascadingMenuButton>
      </div>

      {showSearchBoxes ? (
        <span className={sideBySide ? classes.inline : classes.vertical}>
          {views.map(view => (
            <HeaderSearchBoxes key={view.id} view={view} />
          ))}
        </span>
      ) : null}
    </div>
  )
})
export default Header
