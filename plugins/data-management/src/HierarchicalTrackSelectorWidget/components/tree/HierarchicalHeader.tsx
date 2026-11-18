import { useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetChips from '../../../TrackTable/components/FacetChips.tsx'
import TrackFilterBox from '../../../TrackTable/components/TrackFilterBox.tsx'
import ShoppingCart from '../ShoppingCart.tsx'
import HamburgerMenu from './HamburgerMenu.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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

/**
 * The ☰ menu, cart, filter box and filter chips the tree and the table share.
 * The table adds its rows to the ☰ menu, which depend on the columns that fit.
 * The tree's own headings are its category filter, so it has no category chip
 */
const HierarchicalTrackSelectorHeader = observer(
  function HierarchicalTrackSelectorHeader({
    model,
    tableMenuItems,
  }: {
    model: HierarchicalTrackSelectorModel
    tableMenuItems?: () => MenuItem[]
  }) {
    const { classes } = useStyles()
    const { trackTable } = model
    const filterBoxRef = useRef<HTMLInputElement>(null)
    return (
      <>
        <div
          className={classes.toolbar}
          data-testid="hierarchical_track_selector"
        >
          <HamburgerMenu model={model} tableMenuItems={tableMenuItems} />
          <ShoppingCart model={model} />
          <TrackFilterBox
            table={trackTable}
            className={classes.searchBox}
            inputRef={filterBoxRef}
          />
        </div>
        <FacetChips
          table={trackTable}
          filterBoxRef={filterBoxRef}
          omit={tableMenuItems ? [] : ['category']}
        />
      </>
    )
  },
)

export default HierarchicalTrackSelectorHeader
