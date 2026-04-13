import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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
    gap: 2,
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
        <CascadingMenuButton
          size="small"
          title="Menu"
          menuItems={() => model.menuItems()}
        >
          <MoreVertIcon />
        </CascadingMenuButton>
        <ScrollZoomButton model={model} />
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
              label: 'Orientation - Side-by-side',
              type: 'radio',
              checked: sideBySide,
              onClick: () => {
                setSideBySide(true)
              },
            },
            {
              label: 'Orientation - Vertical',
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
