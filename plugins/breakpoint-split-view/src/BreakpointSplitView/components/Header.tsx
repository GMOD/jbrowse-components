import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { useLocalStorage } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import LinkIcon from '@mui/icons-material/Link'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import TuneIcon from '@mui/icons-material/Tune'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import HeaderSearchBoxes from './HeaderSearchBoxes.tsx'

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
  searchBoxContainer: {
    display: 'flex',
    // scroll rather than clip when many rows' search boxes exceed the bar width
    overflowX: 'auto',
    minWidth: 0,
    gap: 12,
  },
  inline: {
    display: 'inline-flex',
  },
  vertical: {
    flexDirection: 'column' as const,
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
  // Persist search-box visibility/orientation per regime (few vs many rows)
  // rather than one global key, so the "compact default" heuristic isn't
  // permanently overridden by a choice made in a differently-sized view.
  const compact = views.length <= 3
  const regime = compact ? 'compact' : 'large'
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    `bsv-showSearchBoxes-${regime}`,
    compact,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    `bsv-sideBySide-${regime}`,
    compact,
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
        <Tooltip title="Scroll wheel zooms instead of scrolls">
          <ToggleButton
            value="scrollZoom"
            selected={model.scrollZoom}
            onChange={() => {
              model.setScrollZoom(!model.scrollZoom)
            }}
            className={classes.toggleButton}
            size="small"
          >
            <ZoomInMapIcon />
          </ToggleButton>
        </Tooltip>
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
          menuItems={() => [
            {
              label: 'Show search boxes',
              type: 'checkbox',
              checked: showSearchBoxes,
              onClick: () => {
                setShowSearchBoxes(!showSearchBoxes)
              },
            },
            {
              label: 'Search box orientation',
              subMenu: [
                {
                  label: 'Side-by-side',
                  type: 'radio',
                  checked: sideBySide,
                  onClick: () => {
                    setSideBySide(true)
                  },
                },
                {
                  label: 'Stacked',
                  type: 'radio',
                  checked: !sideBySide,
                  onClick: () => {
                    setSideBySide(false)
                  },
                },
              ],
            },
          ]}
        >
          <TuneIcon />
        </CascadingMenuButton>
      </div>

      {showSearchBoxes ? (
        <span
          className={cx(
            classes.searchBoxContainer,
            sideBySide ? classes.inline : classes.vertical,
          )}
        >
          {views.map(view => (
            <HeaderSearchBoxes key={view.id} view={view} />
          ))}
        </span>
      ) : null}
    </div>
  )
})
export default Header
