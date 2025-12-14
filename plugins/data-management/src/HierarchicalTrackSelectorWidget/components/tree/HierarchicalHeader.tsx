import { useEffect, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import ClearIcon from '@mui/icons-material/Clear'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import HamburgerMenu from './HamburgerMenu'
import ShoppingCart from '../ShoppingCart'
import FavoriteTracks from './FavoriteTracks'
import RecentlyUsedTracks from './RecentlyUsedTracks'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { TransitionStartFunction } from 'react'

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
}))

const SearchTracksTextField = observer(function ({
  model,
  startTransition,
}: {
  model: HierarchicalTrackSelectorModel
  startTransition: TransitionStartFunction
}) {
  const { filterText } = model
  const [localValue, setLocalValue] = useState(filterText)
  const { classes } = useStyles()

  // Sync local state when model is cleared externally
  useEffect(() => {
    if (filterText === '') {
      setLocalValue('')
    }
  }, [filterText])

  return (
    <TextField
      className={classes.searchBox}
      label="Filter tracks"
      value={localValue}
      onChange={event => {
        const value = event.target.value
        setLocalValue(value)
        startTransition(() => {
          model.setFilterText(value)
        })
      }}
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => {
                  setLocalValue('')
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
  startTransition,
}: {
  model: HierarchicalTrackSelectorModel
  setHeaderHeight: (n: number) => void
  startTransition: TransitionStartFunction
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
        <SearchTracksTextField
          model={model}
          startTransition={startTransition}
        />
        <RecentlyUsedTracks model={model} />
        <FavoriteTracks model={model} />
      </div>
    </div>
  )
})

export default HierarchicalTrackSelectorHeader
