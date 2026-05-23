import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ClearableSearchField from '../../../shared/ClearableSearchField.tsx'
import ShoppingCart from '../ShoppingCart.tsx'
import FavoriteTracks from './FavoriteTracks.tsx'
import HamburgerMenu from './HamburgerMenu.tsx'
import RecentlyUsedTracks from './RecentlyUsedTracks.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
  },
  searchBox: {
    margin: theme.spacing(2),
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
        <RecentlyUsedTracks model={model} />
        <FavoriteTracks model={model} />
      </div>
    )
  },
)

export default HierarchicalTrackSelectorHeader
