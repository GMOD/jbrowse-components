import React, { useState } from 'react'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

// locals
import { getAllChildren, treeToMap, NodeData } from '../util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

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
  const [menuOpen, setMenuOpen] = useState(false)
  const { name, model, id, tree, toggleCollapse } = data

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        if (!menuOpen) {
          toggleCollapse(id)
          setOpen(!isOpen)
        }
      }}
    >
      <Typography>
        {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        {name}
        <CascadingMenuButton
          className={classes.contrastColor}
          onClickExtra={event => event.stopPropagation()}
          onTouchExtra={event => event.stopPropagation()}
          onMenuOpen={() => setMenuOpen(true)}
          onMenuClose={() => setMenuOpen(false)}
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
            {
              label: 'Show all tracks',
              onClick: () => {
                for (const entry of treeToMap(tree).get(id)?.children || []) {
                  if (!entry.children.length) {
                    model.view.showTrack(entry.id)
                  }
                }
              },
            },
            {
              label: 'Hide all tracks',
              onClick: () => {
                for (const entry of treeToMap(tree).get(id)?.children || []) {
                  if (!entry.children.length) {
                    model.view.hideTrack(entry.id)
                  }
                }
              },
            },
          ]}
        >
          <MoreHorizIcon />
        </CascadingMenuButton>
      </Typography>
    </div>
  )
}
