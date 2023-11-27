import React from 'react'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// icons
import ClearIcon from '@mui/icons-material/Clear'
import HistoryIcon from '@mui/icons-material/History'
import GradeIcon from '@mui/icons-material/Grade'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import HamburgerMenu from './HamburgerMenu'
import ShoppingCart from '../ShoppingCart'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
}))

const SearchTracksTextField = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { filterText } = model
  const { classes } = useStyles()
  return (
    <TextField
      className={classes.searchBox}
      label="Filter tracks"
      value={filterText}
      onChange={event => model.setFilterText(event.target.value)}
      fullWidth
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={() => model.clearFilterText()}>
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
})

const RecentlyUsed = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { view, recentlyUsedTracks } = model
  const { tracks } = view
  return (
    <CascadingMenuButton
      menuItems={recentlyUsedTracks.map(t => ({
        type: 'checkbox',
        label: readConfObject(t, 'name'),
        checked: tracks.some(
          (f: { configuration: AnyConfigurationModel }) =>
            f.configuration === t,
        ),
        onClick: () => {
          model.view.toggleTrack(t.trackId)
        },
      }))}
    >
      <HistoryIcon />
    </CascadingMenuButton>
  )
})

const Favorites = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { view, favoriteTracks } = model
  const { tracks } = view
  return favoriteTracks.length ? (
    <CascadingMenuButton
      menuItems={favoriteTracks.map(t => ({
        type: 'checkbox',
        label: readConfObject(t, 'name'),
        checked: tracks.some(
          (f: { configuration: AnyConfigurationModel }) =>
            f.configuration === t,
        ),
        onClick: () => {
          model.view.toggleTrack(t.trackId)
        },
      }))}
    >
      <GradeIcon />
    </CascadingMenuButton>
  ) : null
})

const HierarchicalTrackSelectorHeader = observer(function ({
  model,
  setHeaderHeight,
}: {
  model: HierarchicalTrackSelectorModel
  setHeaderHeight: (n: number) => void
}) {
  return (
    <div
      ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
      data-testid="hierarchical_track_selector"
    >
      <div style={{ display: 'flex' }}>
        <HamburgerMenu model={model} />
        <ShoppingCart model={model} />
        <SearchTracksTextField model={model} />
        <RecentlyUsed model={model} />
        <Favorites model={model} />
      </div>
    </div>
  )
})

export default HierarchicalTrackSelectorHeader
