import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVert from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'
import { tableMenuItems } from './tableLayout.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

const useStyles = makeStyles()(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
  },
  searchBox: {
    flexGrow: 1,
    margin: theme.spacing(1, 1, 1, 1.5),
  },
}))

/**
 * a dialog table's own filter box and menu; the drawer's table shares the
 * track selector's header
 */
const FacetedHeader = observer(function FacetedHeader({
  model,
  faceted,
  shown,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
  shown: string[]
}) {
  const { classes } = useStyles()
  const { matchCounts } = faceted
  return (
    <div className={classes.toolbar}>
      <ClearableSearchField
        className={classes.searchBox}
        label="Filter tracks"
        value={faceted.filterText}
        status={
          matchCounts
            ? `${matchCounts.matched} of ${matchCounts.total}`
            : undefined
        }
        onChange={value => {
          faceted.setFilterText(value)
        }}
      />
      <CascadingMenuButton
        tooltip="Table options"
        menuItems={() => tableMenuItems(faceted, shown)}
      >
        <MoreVert />
      </CascadingMenuButton>
      <ShoppingCart model={model} />
    </div>
  )
})

export default FacetedHeader
