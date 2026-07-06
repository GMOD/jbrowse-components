import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { useLocalStorage } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { Divider, ToggleButton } from '@mui/material'
import { observer } from 'mobx-react'

import ColorBySelector from './ColorBySelector.tsx'
import HeaderSearchBoxes from './HeaderSearchBoxes.tsx'
import SyntenySettingsPopover from './SyntenySettingsPopover.tsx'
import { asSyntenyModel } from '../../LinearSyntenyView/model.ts'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
  },
  inline: {
    display: 'inline-flex',
  },
  vertical: {
    flexDirection: 'column' as const,
  },
  searchBoxContainer: {
    display: 'flex',
    // scroll rather than clip when many rows' search boxes exceed the bar width
    overflowX: 'auto',
    minWidth: 0,
  },
  scrollZoomButton: {
    height: 44,
    border: 'none',
    textTransform: 'none',
  },
})

const Header = observer(function Header({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { views } = model
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    'lcv-showSearchBoxes',
    views.length <= 3,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    'lcv-sideBySide',
    views.length <= 3,
  )

  const syntenyModel = asSyntenyModel(model)

  // Track selectors for each synteny level (between adjacent rows) and each
  // individual genome row. Shown flat for a two-genome view, grouped into
  // submenus once there are more rows.
  const syntenySelectors = views.slice(0, -1).map((_, idx) => ({
    label: `Row ${idx + 1} → ${idx + 2} (${views[idx]!.assemblyNames.join(',')} → ${views[idx + 1]!.assemblyNames.join(',')})`,
    onClick: () => {
      model.activateTrackSelector(idx)
    },
  }))
  const rowSelectors = views.map((view, idx) => ({
    label: `Row ${idx + 1} track selector (${view.assemblyNames.join(',')})`,
    onClick: () => {
      view.activateTrackSelector()
    },
  }))

  return (
    <div className={classes.headerBar}>
      <CascadingMenuButton
        tooltip="Open track selectors"
        menuItems={() =>
          views.length === 2
            ? [...syntenySelectors, ...rowSelectors]
            : [
                {
                  label: 'Synteny track selectors',
                  type: 'subMenu',
                  subMenu: syntenySelectors,
                },
                {
                  label: 'Row track selectors',
                  type: 'subMenu',
                  subMenu: rowSelectors,
                },
              ]
        }
      >
        <TrackSelectorIcon />
      </CascadingMenuButton>
      <CascadingMenuButton
        tooltip="View options"
        menuItems={() => [
          {
            label: 'Row view menus',
            type: 'subMenu',
            subMenu: views.map((view, idx) => ({
              label: `View ${idx + 1} Menu`,
              subMenu: view.menuItems(),
            })),
          },
          ...model.headerMenuItems(),
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              ...model.showMenuItems(),
              {
                label: 'Show search boxes',
                type: 'checkbox' as const,
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
                    type: 'radio' as const,
                    checked: sideBySide,
                    onClick: () => {
                      setSideBySide(true)
                    },
                  },
                  {
                    label: 'Vertical',
                    type: 'radio' as const,
                    checked: !sideBySide,
                    onClick: () => {
                      setSideBySide(false)
                    },
                  },
                ],
              },
            ],
          },
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>
      <ToggleButton
        value="scrollZoom"
        selected={model.scrollZoom}
        onChange={() => {
          model.setScrollZoom(!model.scrollZoom)
        }}
        title="Scroll wheel zooms instead of scrolls"
        className={classes.scrollZoomButton}
        size="small"
      >
        <ZoomInMapIcon />
      </ToggleButton>

      {syntenyModel ? (
        <>
          <Divider orientation="vertical" flexItem />
          <ColorBySelector model={syntenyModel} />
          <SyntenySettingsPopover model={syntenyModel} />
        </>
      ) : null}

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
