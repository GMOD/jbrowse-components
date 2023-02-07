import React, { useState } from 'react'
import { IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import JBrowseMenu from '@jbrowse/core/ui/Menu'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

// locals
import { getAllChildren, treeToMap, NodeData } from '../util'

const useStyles = makeStyles()(theme => ({
  contrastColor: {
    color: theme.palette.tertiary.contrastText,
  },

  // margin:auto 0 to center text vertically
  accordionText: {
    margin: 'auto 0',
    // width 100 so you can click anywhere on the category bar
    width: '100%',
  },
}))

export default function Category({
  isOpen,
  setOpen,
  data,
}: {
  isOpen: boolean
  setOpen: (arg: boolean) => void
  data: NodeData
}) {
  const { classes } = useStyles()
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)
  const { name, model, id, tree, toggleCollapse } = data

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        if (!menuEl) {
          toggleCollapse(id)
          setOpen(!isOpen)
        }
      }}
    >
      <Typography>
        {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        {name}
        <IconButton
          onClick={event => {
            setMenuEl(event.currentTarget)
            event.stopPropagation()
          }}
          className={classes.contrastColor}
        >
          <MoreHorizIcon />
        </IconButton>
      </Typography>
      {menuEl ? (
        <JBrowseMenu
          anchorEl={menuEl}
          menuItems={[
            {
              label: 'Add to selection',
              onClick: () => {
                const r = treeToMap(tree).get(id)
                model.addToSelection(getAllChildren(r))
              },
            },
            {
              label: 'Remove from selection',
              onClick: () => {
                const r = treeToMap(tree).get(id)
                model.removeFromSelection(getAllChildren(r))
              },
            },
          ]}
          onMenuItemClick={(_event, callback) => {
            callback()
            setMenuEl(null)
          }}
          open={Boolean(menuEl)}
          onClose={() => setMenuEl(null)}
        />
      ) : null}
    </div>
  )
}
