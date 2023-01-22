import React, { Suspense, lazy, useState } from 'react'
import {
  Badge,
  Button,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import JBrowseMenu, { MenuItem } from '@jbrowse/core/ui/Menu'
import { getSession, getEnv } from '@jbrowse/core/util'

// icons
import ClearIcon from '@mui/icons-material/Clear'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

// locals
import { HierarchicalTrackSelectorModel } from '../model'
import HamburgerMenu from './HamburgerMenu'

// lazies
const FacetedDialog = lazy(() => import('./faceted/FacetedDialog'))

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
  setAssemblyIdx,
}: {
  model: HierarchicalTrackSelectorModel
  setHeaderHeight: (n: number) => void
  setAssemblyIdx: (n: number) => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [selectionEl, setSelectionEl] = useState<HTMLButtonElement>()
  const [facetedOpen, setFacetedOpen] = useState(false)
  const { selection, filterText } = model
  const { pluginManager } = getEnv(model)
  const items = pluginManager.evaluateExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    [],
    { session },
  ) as MenuItem[]
  return (
    <div
      ref={ref => setHeaderHeight(ref?.getBoundingClientRect().height || 0)}
      data-testid="hierarchical_track_selector"
    >
      <div style={{ display: 'flex' }}>
        <HamburgerMenu model={model} setAssemblyIdx={setAssemblyIdx} />
        {selection.length ? (
          <IconButton
            className={classes.menuIcon}
            onClick={event => setSelectionEl(event.currentTarget)}
          >
            <Badge badgeContent={selection.length} color="primary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        ) : null}

        <TextField
          className={classes.searchBox}
          label="Filter tracks"
          value={filterText}
          onChange={event => model.setFilterText(event.target.value)}
          fullWidth
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  color="secondary"
                  onClick={() => model.clearFilterText()}
                >
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

      <JBrowseMenu
        anchorEl={selectionEl}
        open={Boolean(selectionEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setSelectionEl(undefined)
        }}
        onClose={() => setSelectionEl(undefined)}
        menuItems={[
          { label: 'Clear', onClick: () => model.clearSelection() },
          ...items.map(item => ({
            ...item,
            ...('onClick' in item
              ? { onClick: () => item.onClick(model) }
              : {}),
          })),
        ]}
      />

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
