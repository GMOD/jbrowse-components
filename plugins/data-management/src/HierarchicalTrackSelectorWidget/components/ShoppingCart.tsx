import React, { useState } from 'react'
import { Badge, IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import JBrowseMenu, { MenuItem } from '@jbrowse/core/ui/Menu'
import { getSession, getEnv } from '@jbrowse/core/util'

// icons
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

// locals
import { HierarchicalTrackSelectorModel } from '../model'

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
  menuIcon: {
    marginRight: theme.spacing(1),
    marginBottom: 0,
  },
}))

export default observer(function ShoppingCart({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { selection } = model
  const { pluginManager } = getEnv(model)
  const session = getSession(model)
  const [selectionEl, setSelectionEl] = useState<HTMLButtonElement>()
  const items = pluginManager.evaluateExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    [],
    { session },
  ) as MenuItem[]

  return (
    <>
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
    </>
  )
})
