import { useState } from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { getAllChildren, treeToMap } from '../util'

import type { TreeNode } from '../../generateHierarchy'
import type { NodeData } from '../util'

function getAllSubcategories(node: TreeNode): string[] {
  const categoryIds: string[] = []
  if (node.type === 'category') {
    for (const child of node.children) {
      if (child.type === 'category') {
        categoryIds.push(child.id, ...getAllSubcategories(child))
      }
    }
  }
  return categoryIds
}

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
  const { menuItems = [], name, model, id, tree } = data

  const currentNode = treeToMap(tree).get(id)
  const subcategoryIds = currentNode ? getAllSubcategories(currentNode) : []
  const hasSubcategories = subcategoryIds.length > 0

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        if (!menuOpen) {
          data.toggleCollapse(id)
          setOpen(!isOpen)
        }
      }}
    >
      <Typography data-testid={`htsCategory-${name}`}>
        {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        {name}
        <CascadingMenuButton
          menuItems={[
            {
              label: 'Add to selection',
              onClick: () => {
                const r = treeToMap(tree).get(id)
                model.addToSelection(getAllChildren(r))
              },
              helpText:
                'Add all tracks in this category to the current selection. This allows you to perform bulk operations on multiple tracks at once, such as configuring settings or exporting track configurations.',
            },
            {
              label: 'Remove from selection',
              onClick: () => {
                const r = treeToMap(tree).get(id)
                model.removeFromSelection(getAllChildren(r))
              },
              helpText:
                'Remove all tracks in this category from the current selection. Use this to deselect tracks that were previously added to your selection.',
            },
            {
              label: 'Show all',
              onClick: () => {
                for (const entry of treeToMap(tree).get(id)?.children || []) {
                  if (entry.type === 'track') {
                    model.view.showTrack(entry.trackId)
                  }
                }
              },
              helpText:
                'Display all tracks in this category on the current view. This is useful when you want to visualize multiple related tracks simultaneously to compare their data.',
            },
            {
              label: 'Hide all',
              onClick: () => {
                for (const entry of treeToMap(tree).get(id)?.children || []) {
                  if (entry.type === 'track') {
                    model.view.hideTrack(entry.trackId)
                  }
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
                        // Only collapse if currently open
                        if (!model.collapsed.get(subcategoryId)) {
                          model.toggleCategory(subcategoryId)
                        }
                      }
                    },
                    helpText:
                      'Collapse all nested subcategories within this category. This provides a cleaner, more compact view of the track hierarchy by hiding the detailed contents of subcategories.',
                  },
                  {
                    label: 'Expand all subcategories',
                    onClick: () => {
                      for (const subcategoryId of subcategoryIds) {
                        // Only expand if currently collapsed
                        if (model.collapsed.get(subcategoryId)) {
                          model.toggleCategory(subcategoryId)
                        }
                      }
                    },
                    helpText:
                      'Expand all nested subcategories within this category. This reveals all tracks and subcategories at once, making it easier to browse and select tracks from the entire hierarchy.',
                  },
                ]
              : []),
            ...menuItems,
          ]}
          className={classes.contrastColor}
          stopPropagation
          setOpen={setMenuOpen}
        >
          <MoreHorizIcon />
        </CascadingMenuButton>
      </Typography>
    </div>
  )
}
