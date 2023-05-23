import React, { Suspense, lazy, useState } from 'react'
import { Button, IconButton, InputAdornment, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// icons
import ClearIcon from '@mui/icons-material/Clear'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import HamburgerMenu from './HamburgerMenu'
import ShoppingCart from '../ShoppingCart'

// lazies
const FacetedDialog = lazy(() => import('../faceted/FacetedDialog'))

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
  menuIcon: {
    marginRight: theme.spacing(1),
    marginBottom: 0,
  },
}))

function HierarchicalTrackSelectorHeader({
  model,
  setHeaderHeight,
}: {
  model: HierarchicalTrackSelectorModel
  setHeaderHeight: (n: number) => void
}) {
  const { classes } = useStyles()
  const [facetedOpen, setFacetedOpen] = useState(false)
  const { filterText } = model

  return (
    <div
      ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
      data-testid="hierarchical_track_selector"
    >
      <div style={{ display: 'flex' }}>
        <HamburgerMenu model={model} />
        <ShoppingCart model={model} />

        <TextField
          className={classes.searchBox}
          label="Filter tracks"
          value={filterText}
          onChange={event => model.setFilterText(event.target.value)}
          fullWidth
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => model.clearFilterText()}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <Button
          className={classes.menuIcon}
          onClick={() => setFacetedOpen(true)}
        >
          Open faceted selector
        </Button>
      </div>

      <Suspense fallback={<div />}>
        {facetedOpen ? (
          <FacetedDialog
            handleClose={() => setFacetedOpen(false)}
            model={model}
          />
        ) : null}
      </Suspense>
    </div>
  )
}

export default observer(HierarchicalTrackSelectorHeader)
