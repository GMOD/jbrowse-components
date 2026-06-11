import { makeStyles } from '@jbrowse/core/util/tss-react'
import GradeIcon from '@mui/icons-material/Grade'
import HistoryIcon from '@mui/icons-material/History'
import { observer } from 'mobx-react'

import BadgeDropdownTracks from './BadgeDropdownTracks.tsx'
import HamburgerMenu from './HamburgerMenu.tsx'
import ClearableSearchField from '../../../shared/ClearableSearchField.tsx'
import ShoppingCart from '../ShoppingCart.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
  },
  searchBox: {
    margin: theme.spacing(2),
    flexGrow: 1,
  },
}))

const HierarchicalTrackSelectorHeader = observer(
  function HierarchicalTrackSelectorHeader({
    model,
  }: {
    model: HierarchicalTrackSelectorModel
  }) {
    const { classes } = useStyles()
    return (
      <div
        className={classes.toolbar}
        data-testid="hierarchical_track_selector"
      >
        <HamburgerMenu model={model} />
        <ShoppingCart model={model} />
        <ClearableSearchField
          className={classes.searchBox}
          label="Filter tracks"
          value={model.filterText}
          onChange={v => {
            model.setFilterText(v)
          }}
        />
        <BadgeDropdownTracks
          data-testid="recently-used-tracks-button"
          model={model}
          tracks={model.recentlyUsedTracks}
          counter={model.recentlyUsedCounter}
          icon={<HistoryIcon />}
          tooltip="Recently used tracks"
          clearLabel="Clear recently used"
          emptyLabel="No recently used"
          onClear={() => {
            model.clearRecentlyUsed()
          }}
          onOpen={() => {
            model.setRecentlyUsedCounter(0)
          }}
        />
        <BadgeDropdownTracks
          data-testid="favorite-tracks-button"
          model={model}
          tracks={model.favoriteTracks}
          counter={model.favoritesCounter}
          icon={<GradeIcon />}
          tooltip="Favorite tracks"
          clearLabel="Clear favorites"
          emptyLabel="No favorite tracks yet"
          onClear={() => {
            model.clearFavorites()
          }}
          onOpen={() => {
            model.setFavoritesCounter(0)
          }}
        />
      </div>
    )
  },
)

export default HierarchicalTrackSelectorHeader
