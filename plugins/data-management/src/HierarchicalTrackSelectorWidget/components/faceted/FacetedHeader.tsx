import { useEffect, useState, useTransition } from 'react'

import { Menu } from '@jbrowse/core/ui'
import ClearIcon from '@mui/icons-material/Clear'
import MoreVert from '@mui/icons-material/MoreVert'
import { Grid, IconButton, InputAdornment, TextField } from '@mui/material'

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
  const [localFilterText, setLocalFilterText] = useState(filterText)
  const [, startTransition] = useTransition()

  // Sync local state when model is cleared externally
  useEffect(() => {
    if (filterText === '') {
      setLocalFilterText('')
    }
  }, [filterText])

  return (
    <>
      <Grid container spacing={4} alignItems="center">
        <TextField
          label="Search..."
          value={localFilterText}
          onChange={event => {
            const value = event.target.value
            setLocalFilterText(value)
            startTransition(() => {
              faceted.setFilterText(value)
            })
          }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => {
                      setLocalFilterText('')
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
