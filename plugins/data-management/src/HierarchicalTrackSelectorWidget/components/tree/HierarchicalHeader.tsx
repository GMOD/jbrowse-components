import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ShoppingCart from '../ShoppingCart.tsx'
import HamburgerMenu from './HamburgerMenu.tsx'

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
      </div>
    )
  },
)

export default HierarchicalTrackSelectorHeader
