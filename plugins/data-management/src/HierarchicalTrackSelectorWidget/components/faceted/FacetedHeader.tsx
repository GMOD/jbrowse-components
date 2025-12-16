import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import MoreVert from '@mui/icons-material/MoreVert'
import { Grid, IconButton } from '@mui/material'

import ClearableSearchField from '../ClearableSearchField'
import ShoppingCart from '../ShoppingCart'

import type { HierarchicalTrackSelectorModel } from '../../model'

export default function FacetedHeader({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { faceted } = model
  const { filterText, showOptions, showFilters, showSparse, useShoppingCart } =
    faceted
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Grid container spacing={4} alignItems="center">
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
        onClose={() => {
          setAnchorEl(null)
        }}
        onMenuItemClick={(_event, callback) => {
          callback()
          setAnchorEl(null)
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
            label: 'Show extra table options',
            onClick: () => {
              faceted.setShowOptions(!showOptions)
            },
            checked: showOptions,
            type: 'checkbox',
          },
        ]}
      />
    </>
  )
}
