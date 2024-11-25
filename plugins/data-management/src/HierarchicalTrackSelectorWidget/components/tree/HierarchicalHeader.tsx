import React from 'react'
import ClearIcon from '@mui/icons-material/Clear'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import HamburgerMenu from './HamburgerMenu'
import ShoppingCart from '../ShoppingCart'
import FavoriteTracks from './FavoriteTracks'
import RecentlyUsedTracks from './RecentlyUsedTracks'
import type { HierarchicalTrackSelectorModel } from '../../model'

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
      onChange={event => {
        model.setFilterText(event.target.value)
      }}
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => {
                  model.clearFilterText()
                }}
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
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
      ref={ref => {
        setHeaderHeight(ref?.getBoundingClientRect().height || 0)
      }}
      data-testid="hierarchical_track_selector"
    >
      <div style={{ display: 'flex' }}>
        <HamburgerMenu model={model} />
        <ShoppingCart model={model} />
        <SearchTracksTextField model={model} />
        <RecentlyUsedTracks model={model} />
        <FavoriteTracks model={model} />
      </div>
    </div>
  )
})

export default HierarchicalTrackSelectorHeader
