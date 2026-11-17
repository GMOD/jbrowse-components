import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetChips from '../../../TrackTable/components/FacetChips.tsx'
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
 * The table adds its rows to the ☰ menu, which depend on the columns that fit
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
    const matchCounts = model.showTable
      ? trackTable.matchCounts
      : model.matchCounts
    return (
      <>
        <div
          className={classes.toolbar}
          data-testid="hierarchical_track_selector"
        >
          <HamburgerMenu model={model} tableMenuItems={tableMenuItems} />
          <ShoppingCart model={model} />
          <ClearableSearchField
            className={classes.searchBox}
            label="Filter tracks"
            value={model.filterText}
            status={
              matchCounts
                ? `${matchCounts.matched} of ${matchCounts.total}`
                : undefined
            }
            onChange={v => {
              model.setFilterText(v)
            }}
          />
        </div>
        <FacetChips table={trackTable} />
      </>
    )
  },
)

export default HierarchicalTrackSelectorHeader
