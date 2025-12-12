import { observer } from 'mobx-react'

import HamburgerMenu from './HamburgerMenu'
import HierarchicalSearchBox from './HierarchicalSearchBox'
import ShoppingCart from '../ShoppingCart'
import FavoriteTracks from './FavoriteTracks'
import RecentlyUsedTracks from './RecentlyUsedTracks'

import type { HierarchicalTrackSelectorModel } from '../../model'

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
        <HierarchicalSearchBox model={model} />
        <RecentlyUsedTracks model={model} />
        <FavoriteTracks model={model} />
      </div>
    </div>
  )
})

export default HierarchicalTrackSelectorHeader
