import { lazy, useCallback, useState } from 'react'

import { CascadingMenuButton, SanitizedHTML } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import FolderIcon from '@mui/icons-material/Folder'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getAllChildren, getAllTrackNodes } from '../util.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeCategoryNode } from '../../types.ts'

const DefaultFolderDialog = lazy(() => import('../DefaultFolderDialog.tsx'))

const useStyles = makeStyles()(theme => ({
  contrastColor: {
    color: theme.palette.tertiary.contrastText,
  },
  accordionText: {
    margin: 'auto 0',
    width: '100%',
  },
  folderLabel: {
    display: 'flex',
    alignItems: 'center',
    marginRight: 0,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  menuButton: {
    padding: 0,
  },
  countBadge: {
    marginLeft: 4,
    opacity: 0.7,
  },
}))

function getAllSubcategories(node: TreeCategoryNode): string[] {
  const categoryIds: string[] = []
  const stack = [node] as TreeCategoryNode[]
  while (stack.length > 0) {
    const curr = stack.pop()!
    for (const child of curr.children) {
      if (child.type === 'category') {
        categoryIds.push(child.id)
        stack.push(child)
      }
    }
  }
  return categoryIds
}

function getTrackIdsFromCategory(node: TreeCategoryNode): string[] {
  return node.children
    .filter(entry => entry.type === 'track')
    .map(entry => entry.trackId)
}

function openFolderDialog(
  model: HierarchicalTrackSelectorModel,
  item: TreeCategoryNode,
) {
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const subtracks = getAllTrackNodes(item)
  const DialogComponent = pluginManager.evaluateExtensionPoint(
    'TrackSelector-folderDialog',
    DefaultFolderDialog,
    { categoryId: item.id, model, subtracks },
  ) as React.FC<{
    model: HierarchicalTrackSelectorModel
    title: string
    subtracks: typeof subtracks
    handleClose: () => void
  }>
  session.queueDialog((handleClose: () => void) => [
    DialogComponent,
    {
      model,
      title: item.name,
      subtracks,
      handleClose,
    },
  ])
}

const FolderCategoryLabel = observer(function FolderCategoryLabel({
  item,
  model,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const [menuOpen, setMenuOpen] = useState(false)
  const { name, id } = item
  const stats = model.folderCategoryStats.get(id)
  const hasActiveSubtracks = (stats?.active ?? 0) > 0

  const getMenuItems = useCallback(() => {
    const nodes = getAllTrackNodes(item)
    return [
      {
        label: 'Expand to category',
        onClick: () => {
          model.toggleFolderCategory(id)
        },
      },
      {
        label: 'Open as faceted selector...',
        onClick: () => {
          openFolderDialog(model, item)
        },
      },
      {
        label: 'Add to selection',
        onClick: () => {
          model.addToSelection(getAllChildren(item))
        },
      },
      {
        label: 'Remove from selection',
        onClick: () => {
          model.removeFromSelection(getAllChildren(item))
        },
      },
      {
        label: 'Show all',
        onClick: () => {
          for (const child of nodes) {
            model.view.showTrack(child.trackId)
          }
        },
      },
      {
        label: 'Hide all',
        onClick: () => {
          for (const child of nodes) {
            model.view.hideTrack(child.trackId)
          }
        },
      },
    ]
  }, [model, item, id])

  return (
    <div
      className={classes.folderLabel}
      onClick={() => {
        if (!menuOpen) {
          openFolderDialog(model, item)
        }
      }}
    >
      <FolderIcon fontSize="small" color="primary" />
      <span data-testid={`htsCategory-${name}`}>
        <SanitizedHTML html={name} />
      </span>
      {hasActiveSubtracks && stats ? (
        <span className={classes.countBadge}>
          ({stats.active}/{stats.total})
        </span>
      ) : null}
      <CascadingMenuButton
        className={classes.menuButton}
        menuItems={getMenuItems}
        stopPropagation
        setOpen={setMenuOpen}
      >
        <MoreHorizIcon />
      </CascadingMenuButton>
    </div>
  )
})

const NormalCategoryLabel = observer(function NormalCategoryLabel({
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
        label: 'Collapse into folder',
        onClick: () => {
          model.toggleFolderCategory(id)
        },
      },
      {
        label: 'Open as faceted selector...',
        onClick: () => {
          openFolderDialog(model, item)
        },
      },
      {
        label: 'Add to selection',
        onClick: () => {
          model.addToSelection(getAllChildren(item))
        },
      },
      {
        label: 'Remove from selection',
        onClick: () => {
          model.removeFromSelection(getAllChildren(item))
        },
      },
      {
        label: 'Show all',
        onClick: () => {
          for (const trackId of getTrackIdsFromCategory(item)) {
            model.view.showTrack(trackId)
          }
        },
      },
      {
        label: 'Hide all',
        onClick: () => {
          for (const trackId of getTrackIdsFromCategory(item)) {
            model.view.hideTrack(trackId)
          }
        },
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
            },
            {
              label: 'Expand all subcategories',
              onClick: () => {
                for (const subcategoryId of subcategoryIds) {
                  model.setCategoryCollapsed(subcategoryId, false)
                }
              },
            },
          ]
        : []),
    ]
  }, [item, model, id])

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

const TrackCategory = observer(function TrackCategory({
  item,
  model,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
}) {
  const isFolderMode = model.folderCategories.has(item.id)
  if (isFolderMode) {
    return <FolderCategoryLabel item={item} model={model} />
  }
  return <NormalCategoryLabel item={item} model={model} />
})

export default TrackCategory
