import { lazy } from 'react'

import {
  CascadingMenuButton,
  PluggableComponent,
  SanitizedHTML,
} from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import FolderIcon from '@mui/icons-material/Folder'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { CircularProgress, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { isNodeCollapsed } from '../../model.ts'
import { getAllSubcategories, getAllTrackNodes } from '../../util.ts'
import { useMenuGuardedClick } from './useMenuGuardedClick.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeCategoryNode, TreeTrackNode } from '../../types.ts'
import type { ComponentType } from 'react'

export interface FolderDialogProps {
  model: HierarchicalTrackSelectorModel
  categoryId: string
  title: string
  subtracks: TreeTrackNode[]
  handleClose: () => void
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'TrackSelector-folderDialog': {
      args: ComponentType<FolderDialogProps>
      result: ComponentType<FolderDialogProps>
      props: FolderDialogProps
    }
  }
}

const DefaultFolderDialog = lazy(() => import('../DefaultFolderDialog.tsx'))

// resolves TrackSelector-folderDialog at render time (consistent with all other
// component extension points) rather than evaluating the point by hand; queued
// into the session dialog stack, which provides its own Suspense boundary
const FolderDialog = observer(function FolderDialog(props: FolderDialogProps) {
  const { pluginManager } = getEnv(props.model)
  return (
    <PluggableComponent
      pluginManager={pluginManager}
      /** #extensionPoint TrackSelector-folderDialog | sync | Replace the dialog shown when a folder category is clicked */
      name="TrackSelector-folderDialog"
      component={DefaultFolderDialog}
      props={props}
    />
  )
})

const useStyles = makeStyles()(theme => ({
  contrastColor: {
    color: theme.palette.tertiary.contrastText,
  },
  accordionText: {
    margin: 'auto 0',
    width: '100%',
    '& a': {
      color: 'inherit',
    },
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
  spinner: {
    marginLeft: 4,
    verticalAlign: 'middle',
  },
}))

function subcategoryCollapseMenuItems(
  model: HierarchicalTrackSelectorModel,
  subcategoryIds: string[],
) {
  return subcategoryIds.length > 0
    ? [
        {
          label: 'Collapse all subcategories',
          onClick: () => {
            for (const id of subcategoryIds) {
              model.setCategoryCollapsed(id, true)
            }
          },
        },
        {
          label: 'Expand all subcategories',
          onClick: () => {
            for (const id of subcategoryIds) {
              model.setCategoryCollapsed(id, false)
            }
          },
        },
      ]
    : []
}

// Menu items shared by folder-mode and normal-mode category labels
function categoryTrackMenuItems(
  model: HierarchicalTrackSelectorModel,
  item: TreeCategoryNode,
) {
  const trackNodes = getAllTrackNodes(item)
  return [
    {
      label: 'Open as faceted selector...',
      onClick: () => {
        openFolderDialog(model, item)
      },
    },
    {
      label: 'Add to selection',
      onClick: () => {
        model.addToSelection(trackNodes.map(n => n.conf))
      },
    },
    {
      label: 'Remove from selection',
      onClick: () => {
        model.removeFromSelection(trackNodes.map(n => n.conf))
      },
    },
    {
      label: 'Show all',
      onClick: () => {
        for (const node of trackNodes) {
          model.view.showTrack(node.trackId)
        }
      },
    },
    {
      label: 'Hide all',
      onClick: () => {
        for (const node of trackNodes) {
          model.view.hideTrack(node.trackId)
        }
      },
    },
  ]
}

function openFolderDialog(
  model: HierarchicalTrackSelectorModel,
  item: TreeCategoryNode,
) {
  const subtracks = getAllTrackNodes(item)
  getSession(model).queueDialog(handleClose => [
    FolderDialog,
    {
      model,
      categoryId: item.id,
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
  const { name, id } = item
  const stats = model.folderCategoryStats.get(id)
  const { setMenuOpen, guard } = useMenuGuardedClick()

  return (
    <div
      className={classes.folderLabel}
      onClick={() => {
        guard(() => {
          openFolderDialog(model, item)
        })
      }}
    >
      <FolderIcon fontSize="small" color="primary" />
      <span data-testid={`htsCategory-${name}`}>
        <SanitizedHTML html={name} />
      </span>
      {stats && stats.active > 0 ? (
        <span className={classes.countBadge}>
          ({stats.active}/{stats.total})
        </span>
      ) : null}
      <CascadingMenuButton
        className={classes.menuButton}
        data-testid={`htsCategoryMenu-${name}`}
        menuItems={() => [
          {
            label: 'Expand to category',
            onClick: () => {
              model.toggleFolderCategory(id)
            },
          },
          ...categoryTrackMenuItems(model, item),
        ]}
        stopPropagation
        setOpen={open => {
          setMenuOpen(open)
        }}
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
  const { name, id } = item
  const isOpen = !isNodeCollapsed(item, model.collapsed)
  const { setMenuOpen, guard } = useMenuGuardedClick()

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        guard(() => {
          model.toggleCategory(id)
        })
      }}
    >
      <Typography data-testid={`htsCategory-${name}`}>
        {isOpen ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        <SanitizedHTML html={name} />
        {item.loading ? (
          <CircularProgress size={12} className={classes.spinner} />
        ) : null}
        <CascadingMenuButton
          data-testid={`htsCategoryMenu-${name}`}
          menuItems={() => {
            const subcategoryIds = getAllSubcategories(item)
            return [
              {
                label: 'Collapse into folder',
                onClick: () => {
                  model.toggleFolderCategory(id)
                },
              },
              ...categoryTrackMenuItems(model, item),
              ...subcategoryCollapseMenuItems(model, subcategoryIds),
            ]
          }}
          className={classes.contrastColor}
          stopPropagation
          setOpen={open => {
            setMenuOpen(open)
          }}
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
  return model.folderCategories.has(item.id) ? (
    <FolderCategoryLabel item={item} model={model} />
  ) : (
    <NormalCategoryLabel item={item} model={model} />
  )
})

export default TrackCategory
