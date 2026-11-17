import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetChips from '../../../FacetedSelector/components/FacetChips.tsx'
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

interface MatchCounts {
  matched: number
  total: number
}

/**
 * The filter box, menu and filter chips the tree and the table share. The
 * table passes its own menu rows and counts, since its text search also
 * covers the columns it shows.
 */
const HierarchicalTrackSelectorHeader = observer(
  function HierarchicalTrackSelectorHeader({
    model,
    table,
  }: {
    model: HierarchicalTrackSelectorModel
    table?: {
      menuItems: () => MenuItem[]
      matchCounts?: MatchCounts
    }
  }) {
    const { classes } = useStyles()
    const { trackTable } = model
    const matchCounts = table ? table.matchCounts : model.matchCounts
    return (
      <>
        <div
          className={classes.toolbar}
          data-testid="hierarchical_track_selector"
        >
          <HamburgerMenu model={model} viewMenuItems={table?.menuItems} />
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
        {trackTable ? <FacetChips faceted={trackTable} /> : null}
      </>
    )
  },
)

export default HierarchicalTrackSelectorHeader
