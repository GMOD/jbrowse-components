import React, { useState } from 'react'
import JBrowseMenu from '@jbrowse/core/ui/Menu'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import { getAllChildren, treeToMap } from '../util'
import type { NodeData } from '../util'

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
  const { menuItems = [], name, model, id, tree } = data

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        if (!menuEl) {
          data.toggleCollapse(id)
          setOpen(!isOpen)
        }
      }}
    >
      <Typography data-testid={`htsCategory-${name}`}>
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
            {
              label: 'Show all tracks',
              onClick: () => {
                for (const entry of treeToMap(tree).get(id)?.children || []) {
                  if (entry.type === 'track') {
                    model.view.showTrack(entry.trackId)
                  }
                }
              },
            },
            {
              label: 'Hide all tracks',
              onClick: () => {
                for (const entry of treeToMap(tree).get(id)?.children || []) {
                  if (entry.type === 'track') {
                    model.view.hideTrack(entry.trackId)
                  }
                }
              },
            },
            ...menuItems,
          ]}
          onMenuItemClick={(_event, callback) => {
            callback()
            setMenuEl(null)
          }}
          open={Boolean(menuEl)}
          onClose={() => {
            setMenuEl(null)
          }}
        />
      ) : null}
    </div>
  )
}
