import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ClearableSearchField from '../ClearableSearchField.tsx'
import ShoppingCart from '../ShoppingCart.tsx'
import FavoriteTracks from './FavoriteTracks.tsx'
import HamburgerMenu from './HamburgerMenu.tsx'
import RecentlyUsedTracks from './RecentlyUsedTracks.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
}))

const HierarchicalTrackSelectorHeader = observer(
  function HierarchicalTrackSelectorHeader({
    model,
    setHeaderHeight,
  }: {
    model: HierarchicalTrackSelectorModel
    setHeaderHeight: (n: number) => void
  }) {
    const { classes } = useStyles()
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
          <ClearableSearchField
            className={classes.searchBox}
            label="Filter tracks"
            value={model.filterText}
            onChange={value => {
              model.setFilterText(value)
            }}
          />
          <RecentlyUsedTracks model={model} />
          <FavoriteTracks model={model} />
        </div>
      </div>
    )
  },
)

export default HierarchicalTrackSelectorHeader
