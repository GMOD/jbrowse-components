import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetChips from '../../../TrackTable/components/FacetChips.tsx'
import ShoppingCart from '../ShoppingCart.tsx'
import AddMenu from './AddMenu.tsx'

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

/**
 * The add button, cart, filter box and filter chips the tree and the table
 * share
 */
const HierarchicalTrackSelectorHeader = observer(
  function HierarchicalTrackSelectorHeader({
    model,
  }: {
    model: HierarchicalTrackSelectorModel
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
          <AddMenu model={model} />
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
