import React, { useState } from 'react'
import { Menu } from '@jbrowse/core/ui'

// icons
import ClearIcon from '@mui/icons-material/Clear'
import MoreVert from '@mui/icons-material/MoreVert'
import { Grid, IconButton, InputAdornment, TextField } from '@mui/material'

// locals
import ShoppingCart from '../ShoppingCart'
import type { HierarchicalTrackSelectorModel } from '../../model'

export default function FacetedHeader({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { faceted } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const { showOptions, showFilters, showSparse, useShoppingCart } = faceted

  return (
    <>
      <Grid container spacing={4} alignItems="center">
        <Grid item>
          <TextField
            label="Search..."
            value={faceted.filterText}
            onChange={event => {
              faceted.setFilterText(event.target.value)
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => {
                        faceted.setFilterText('')
                      }}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        <Grid item>
          <IconButton
            onClick={event => {
              setAnchorEl(event.currentTarget)
            }}
          >
            <MoreVert />
          </IconButton>
        </Grid>
        <Grid item>
          <ShoppingCart model={model} />
        </Grid>
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
