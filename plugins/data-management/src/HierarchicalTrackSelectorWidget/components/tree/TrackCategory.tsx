import { useCallback, useState } from 'react'

import { CascadingMenuButton, SanitizedHTML } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getAllChildren } from '../util'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { TreeCategoryNode } from '../../types'

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

function getAllSubcategories(node: TreeCategoryNode): string[] {
  const categoryIds: string[] = []
  for (const child of node.children) {
    if (child.type === 'category') {
      categoryIds.push(child.id, ...getAllSubcategories(child))
    }
  }
  return categoryIds
}

function getTrackIdsFromCategory(node: TreeCategoryNode): string[] {
  return node.children
    .filter(entry => entry.type === 'track')
    .map(entry => entry.trackId)
}

const TrackCategory = observer(function TrackCategory({
  item,
  model,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const [menuOpen, setMenuOpen] = useState(false)
  const { name, id } = item
  const isOpen = !model.collapsed.get(id)

  const getMenuItems = useCallback(() => {
    const subcategoryIds = getAllSubcategories(item)
    const hasSubcategories = subcategoryIds.length > 0

    return [
      {
        label: 'Add to selection',
        onClick: () => {
          model.addToSelection(getAllChildren(item))
        },
        helpText:
          'Add all tracks in this category to the current selection. This allows you to perform bulk operations on multiple tracks at once, such as configuring settings or exporting track configurations.',
      },
      {
        label: 'Remove from selection',
        onClick: () => {
          model.removeFromSelection(getAllChildren(item))
        },
        helpText:
          'Remove all tracks in this category from the current selection. Use this to deselect tracks that were previously added to your selection.',
      },
      {
        label: 'Show all',
        onClick: () => {
          for (const trackId of getTrackIdsFromCategory(item)) {
            model.view.showTrack(trackId)
          }
        },
        helpText:
          'Display all tracks in this category on the current view. This is useful when you want to visualize multiple related tracks simultaneously to compare their data.',
      },
      {
        label: 'Hide all',
        onClick: () => {
          for (const trackId of getTrackIdsFromCategory(item)) {
            model.view.hideTrack(trackId)
          }
        },
        helpText:
          'Hide all tracks in this category from the current view. This helps declutter your view by removing tracks you are not currently analyzing.',
      },
      ...(hasSubcategories
        ? [
            {
              label: 'Collapse all subcategories',
              onClick: () => {
                for (const subcategoryId of subcategoryIds) {
                  model.setCategoryCollapsed(subcategoryId, true)
                }
              },
              helpText:
                'Collapse all nested subcategories within this category. This provides a cleaner, more compact view of the track hierarchy by hiding the detailed contents of subcategories.',
            },
            {
              label: 'Expand all subcategories',
              onClick: () => {
                for (const subcategoryId of subcategoryIds) {
                  model.setCategoryCollapsed(subcategoryId, false)
                }
              },
              helpText:
                'Expand all nested subcategories within this category. This reveals all tracks and subcategories at once, making it easier to browse and select tracks from the entire hierarchy.',
            },
          ]
        : []),
    ]
  }, [item, model])

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        if (!menuOpen) {
          model.toggleCategory(id)
        }
      }}
    >
      <Typography data-testid={`htsCategory-${name}`}>
        {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        <SanitizedHTML html={name} />
        <CascadingMenuButton
          menuItems={getMenuItems}
          className={classes.contrastColor}
          stopPropagation
          setOpen={setMenuOpen}
        >
          <MoreHorizIcon />
        </CascadingMenuButton>
      </Typography>
    </div>
  )
})

export default TrackCategory
