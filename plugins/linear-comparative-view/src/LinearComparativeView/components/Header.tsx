import { useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import { Box, FormGroup, Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import HeaderSearchBoxes from './HeaderSearchBoxes'

import type { LinearComparativeViewModel } from '../model'
import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model'

const useStyles = makeStyles()({
  inline: {
    display: 'inline-flex',
  },
  alphaSlider: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 150,
  },
})

const Header = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { views, levels } = model
  const [showSearchBoxes, setShowSearchBoxes] = useState(views.length <= 3)
  const [sideBySide, setSideBySide] = useState(views.length <= 3)

  // Get the first synteny display from the first level (if it exists)
  const firstDisplay = levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined
  const alpha = firstDisplay?.alpha ?? 1

  const handleAlphaChange = (_event: Event, value: number | number[]) => {
    const newAlpha = typeof value === 'number' ? value : value[0]!
    // Set alpha for all synteny displays across all levels
    for (const level of levels) {
      for (const track of level.tracks) {
        for (const display of track.displays) {
          ;(display as LinearSyntenyDisplayModel).setAlpha(newAlpha)
        }
      }
    }
  }

  return (
    <FormGroup row>
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

      {firstDisplay ? (
        <Box className={classes.alphaSlider}>
          <Typography variant="body2" style={{ marginRight: 8 }}>
            Opacity:
          </Typography>
          <Slider
            value={alpha}
            onChange={handleAlphaChange}
            min={0}
            max={1}
            step={0.05}
            valueLabelDisplay="auto"
            size="small"
            style={{ minWidth: 100 }}
          />
        </Box>
      ) : null}

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
