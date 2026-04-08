import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import MoreVert from '@mui/icons-material/MoreVert'
import { Grid, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import ClearableSearchField from '../../HierarchicalTrackSelectorWidget/components/ClearableSearchField.tsx'
import ShoppingCart from '../../HierarchicalTrackSelectorWidget/components/ShoppingCart.tsx'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

const FacetedHeader = observer(function FacetedHeader({
  model,
  faceted,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
}) {
  const {
    filterText,
    showFilters,
    showSparse,
    useShoppingCart,
    visible,
    fields,
  } = faceted
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Grid container alignItems="center">
        <ClearableSearchField
          label="Search..."
          value={filterText}
          onChange={value => {
            faceted.setFilterText(value)
          }}
        />
        <IconButton
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
        onMenuItemClick={(_event, callback) => {
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
            label: 'Show sparse metadata columns',
            onClick: () => {
              faceted.setShowSparse(!showSparse)
            },
            checked: showSparse,
            type: 'checkbox',
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
              .filter(f => f !== 'name')
              .map(field => ({
                label: field,
                type: 'checkbox' as const,
                checked: visible[field] !== false,
                onClick: () => {
                  faceted.setVisible({
                    ...visible,
                    [field]: visible[field] === false,
                  })
                },
              })),
          },
        ]}
      />
    </>
  )
})

export default FacetedHeader
