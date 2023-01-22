import React from 'react'
import {
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material'

// icons
import ClearIcon from '@mui/icons-material/Clear'

// locals
import ShoppingCart from '../ShoppingCart'
import { HierarchicalTrackSelectorModel } from '../../model'

export default function FacetedHeader({
  setFilterText,
  setUseShoppingCart,
  setHideSparse,
  hideSparse,
  useShoppingCart,
  filterText,
  model,
}: {
  setFilterText: (arg: string) => void
  setUseShoppingCart: (arg: boolean) => void
  setHideSparse: (arg: boolean) => void
  filterText: string
  useShoppingCart: boolean
  hideSparse: boolean
  model: HierarchicalTrackSelectorModel
}) {
  return (
    <Grid container spacing={4} alignItems="center">
      <Grid item>
        <TextField
          label="Search..."
          value={filterText}
          onChange={event => setFilterText(event.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton color="secondary" onClick={() => setFilterText('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Grid>
      <Grid item>
        <FormControlLabel
          control={
            <Checkbox
              checked={useShoppingCart}
              onChange={e => setUseShoppingCart(e.target.checked)}
            />
          }
          label="Add tracks to selection instead of turning them on/off"
        />
      </Grid>
      <Grid item>
        <FormControlLabel
          control={
            <Checkbox
              checked={hideSparse}
              onChange={e => setHideSparse(e.target.checked)}
            />
          }
          label="Hide sparse metadata columns"
        />
      </Grid>
      <Grid item>
        <ShoppingCart model={model} />
      </Grid>
    </Grid>
  )
}
