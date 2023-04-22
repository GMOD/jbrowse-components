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
  setHideSparse,
  setShowOptions,
  showOptions,
  hideSparse,
  useShoppingCart,
  filterText,
  model,
}: {
  setFilterText: (arg: string) => void
  setUseShoppingCart: (arg: boolean) => void
  setHideSparse: (arg: boolean) => void
  setShowOptions: (arg: boolean) => void
  filterText: string
  showOptions: boolean
  useShoppingCart: boolean
  hideSparse: boolean
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
            label: 'Hide sparse metadata columns',
            onClick: () => setHideSparse(!hideSparse),
            checked: hideSparse,
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
