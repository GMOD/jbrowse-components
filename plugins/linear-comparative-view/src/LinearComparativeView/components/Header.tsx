import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { FormGroup, ToggleButton } from '@mui/material'
import { observer } from 'mobx-react'

import ColorBySelector from './ColorBySelector.tsx'
import ColorLegend from './ColorLegend.tsx'
import HeaderSearchBoxes from './HeaderSearchBoxes.tsx'
import SyntenySettingsPopover from './SyntenySettingsPopover.tsx'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  header: {
    flexWrap: 'nowrap',
    alignItems: 'center',
  },
  inline: {
    display: 'inline-flex',
  },
  vertical: {
    flexDirection: 'column' as const,
  },
  searchBoxContainer: {
    display: 'flex',
    overflow: 'hidden',
    minWidth: 0,
  },
  toggleButton: {
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
  const { views, levels, showDynamicControls } = model
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    'lcv-showSearchBoxes',
    views.length <= 3,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    'lcv-sideBySide',
    views.length <= 3,
  )

  const hasDisplays = levels[0]?.tracks[0]?.displays[0]

  return (
    <FormGroup row className={classes.header}>
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
        title="Toggle scroll zoom"
        className={classes.toggleButton}
        size="small"
      >
        <ZoomInMapIcon />
      </ToggleButton>

      {hasDisplays && showDynamicControls ? (
        <>
          <ColorBySelector model={model} />
          <ColorLegend model={model} />
          <SyntenySettingsPopover model={model} />
        </>
      ) : null}

      {showSearchBoxes ? (
        <span
          className={`${classes.searchBoxContainer} ${sideBySide ? classes.inline : classes.vertical}`}
        >
          {views.map(view => (
            <HeaderSearchBoxes key={view.id} view={view} />
          ))}
        </span>
      ) : null}
    </FormGroup>
  )
})
export default Header
