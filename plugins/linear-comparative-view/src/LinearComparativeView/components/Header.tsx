import { useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { FormGroup, ToggleButton } from '@mui/material'
import { observer } from 'mobx-react'

import ColorBySelector from './ColorBySelector.tsx'
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
  const [showSearchBoxes, setShowSearchBoxes] = useState(views.length <= 3)
  const [sideBySide, setSideBySide] = useState(views.length <= 3)

  // Check if we have any displays to show sliders
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
            label: 'Search box orientation - Side-by-side',
            type: 'radio',
            checked: sideBySide,
            onClick: () => {
              setSideBySide(!sideBySide)
            },
          },
          {
            label: 'Search box orientation - Vertical',
            type: 'radio',
            checked: !sideBySide,
            onClick: () => {
              setSideBySide(!sideBySide)
            },
          },
        ]}
      >
        <MoreVertIcon />
      </CascadingMenuButton>
      <ToggleButton
        value="search"
        selected={showSearchBoxes}
        onChange={() => {
          setShowSearchBoxes(!showSearchBoxes)
        }}
        title="Toggle search boxes"
        className={classes.toggleButton}
        size="small"
      >
        <SearchIcon />
      </ToggleButton>
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
          <SyntenySettingsPopover model={model} />
        </>
      ) : null}

      {showSearchBoxes ? (
        <span
          className={`${classes.searchBoxContainer} ${sideBySide ? classes.inline : ''}`}
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
