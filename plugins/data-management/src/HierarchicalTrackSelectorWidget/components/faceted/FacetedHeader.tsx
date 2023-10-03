import React, { useState } from 'react'
import { Grid, IconButton, InputAdornment, TextField } from '@mui/material'
import { Menu } from '@jbrowse/core/ui'

// icons
import ClearIcon from '@mui/icons-material/Clear'
import MoreVert from '@mui/icons-material/MoreVert'

// locals
import ShoppingCart from '../ShoppingCart'
import { HierarchicalTrackSelectorModel } from '../../model'

export default function FacetedHeader({
  setFilterText,
  setUseShoppingCart,
  setShowSparse,
  setShowFilters,
  setShowOptions,
  showOptions,
  showSparse,
  showFilters,
  useShoppingCart,
  filterText,
  model,
}: {
  setFilterText: (arg: string) => void
  setUseShoppingCart: (arg: boolean) => void
  setShowSparse: (arg: boolean) => void
  setShowFilters: (arg: boolean) => void
  setShowOptions: (arg: boolean) => void
  filterText: string
  showOptions: boolean
  useShoppingCart: boolean
  showSparse: boolean
  showFilters: boolean
  model: HierarchicalTrackSelectorModel
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <Grid container spacing={4} alignItems="center">
        <Grid item>
          <TextField
            label="Search..."
            value={filterText}
            onChange={event => setFilterText(event.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setFilterText('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        <Grid item>
          <IconButton onClick={event => setAnchorEl(event.currentTarget)}>
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
        onClose={() => setAnchorEl(null)}
        onMenuItemClick={(_event, callback) => {
          callback()
          setAnchorEl(null)
        }}
        menuItems={[
          {
            label: 'Add tracks to selection instead of turning them on/off',
            onClick: () => setUseShoppingCart(!useShoppingCart),
            type: 'checkbox',
            checked: useShoppingCart,
          },
          {
            label: 'Show sparse metadata columns',
            onClick: () => setShowSparse(!showSparse),
            checked: showSparse,
            type: 'checkbox',
          },
          {
            label: 'Show facet filters',
            onClick: () => setShowFilters(!showFilters),
            checked: showFilters,
            type: 'checkbox',
          },
          {
            label: 'Show extra table options',
            onClick: () => setShowOptions(!showOptions),
            checked: showOptions,
            type: 'checkbox',
          },
        ]}
      />
    </>
  )
}
