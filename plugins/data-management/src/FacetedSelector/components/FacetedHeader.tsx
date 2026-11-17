import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import ClearableSearchField from '@jbrowse/core/ui/ClearableSearchField'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVert from '@mui/icons-material/MoreVert'
import { Grid, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'
import { facetLabel } from './util.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

const useStyles = makeStyles()(theme => ({
  searchBox: {
    flexGrow: 1,
    margin: theme.spacing(1, 1, 1, 1.5),
  },
}))

const FacetedHeader = observer(function FacetedHeader({
  model,
  faceted,
  shown,
  onFilterTextChange,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
  shown: string[]
  onFilterTextChange?: (value: string) => void
}) {
  const { classes } = useStyles()
  const {
    filterText,
    showFilters,
    useShoppingCart,
    fields,
    nonMetadataFieldSet,
  } = faceted
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Grid container sx={{ alignItems: 'center', flexWrap: 'nowrap' }}>
        <ClearableSearchField
          className={classes.searchBox}
          label="Filter tracks"
          value={filterText}
          status={
            faceted.sortedRows.length < faceted.allRows.length
              ? `${faceted.sortedRows.length} of ${faceted.allRows.length}`
              : undefined
          }
          onChange={value => {
            faceted.setFilterText(value)
            onFilterTextChange?.(value)
          }}
        />
        <IconButton
          aria-label="Table options"
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
        >
          <MoreVert />
        </IconButton>
        <ShoppingCart model={model} />
      </Grid>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        closeAfterItemClick={false}
        onClose={() => {
          setAnchorEl(null)
        }}
        onMenuItemClick={callback => {
          callback()
        }}
        menuItems={[
          {
            label: 'Add tracks to selection instead of turning them on/off',
            onClick: () => {
              faceted.setUseShoppingCart(!useShoppingCart)
            },
            type: 'checkbox',
            checked: useShoppingCart,
          },
          {
            label: 'Show facet filters',
            onClick: () => {
              faceted.setShowFilters(!showFilters)
            },
            checked: showFilters,
            type: 'checkbox',
          },
          {
            label: 'Manage columns',
            type: 'subMenu',
            subMenu: fields
              .filter(field => field !== 'name')
              .map(field => {
                const checked = shown.includes(field)
                return {
                  label: facetLabel(field, nonMetadataFieldSet),
                  type: 'checkbox' as const,
                  checked,
                  onClick: () => {
                    faceted.setColumnVisible(field, !checked)
                  },
                }
              }),
          },
        ]}
      />
    </>
  )
})

export default FacetedHeader
