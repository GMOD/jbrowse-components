import { useState } from 'react'

import JBrowseMenu from '@jbrowse/core/ui/Menu'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { getAllChildren, treeToMap } from '../util'

import type { TreeCategoryNode } from '../../types'
import type { HierarchicalTrackSelectorModel } from '../../model'

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

const TrackCategory = observer(function ({
  item,
  model,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)
  const { name, id } = item
  const isOpen = !model.collapsed.get(id)

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        console.log('HEREE!!!', { menuEl, id, name, item })
        if (!menuEl) {
          model.toggleCategory(id)
        }
      }}
    >
      <Typography data-testid={`htsCategory-${name}`}>
        {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        {name}
        <IconButton
          className={classes.contrastColor}
          onClick={event => {
            setMenuEl(event.currentTarget)
            event.stopPropagation()
          }}
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
                const r = treeToMap(item).get(id)
                model.addToSelection(getAllChildren(r))
              },
            },
            {
              label: 'Remove from selection',
              onClick: () => {
                const r = treeToMap(item).get(id)
                model.removeFromSelection(getAllChildren(r))
              },
            },
            {
              label: 'Show all tracks',
              onClick: () => {
                for (const entry of treeToMap(item).get(id)?.children || []) {
                  if (entry.type === 'track') {
                    model.view.showTrack(entry.trackId)
                  }
                }
              },
            },
            {
              label: 'Hide all tracks',
              onClick: () => {
                for (const entry of treeToMap(item).get(id)?.children || []) {
                  if (entry.type === 'track') {
                    model.view.hideTrack(entry.trackId)
                  }
                }
              },
            },
            // ...menuItems,
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
})

export default TrackCategory
