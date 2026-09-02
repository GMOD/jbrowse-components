import { lazy } from 'react'

import {
  CascadingMenuButton,
  PluggableComponent,
  SanitizedHTML,
} from '@jbrowse/core/ui'
import { getDialogHost, getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import FolderIcon from '@mui/icons-material/Folder'
import { CircularProgress, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { isFilterForcedOpen } from '../../model.ts'
import { getAllSubcategories, getAllTrackNodes } from '../../util.ts'
import MoreHorizGlyph from './MoreHorizGlyph.tsx'
import { useMenuGuardedClick } from './useMenuGuardedClick.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type {
  ResolvedCategoryMode,
  TreeCategoryNode,
  TreeTrackNode,
} from '../../types.ts'

// #region folderDialogProps
export interface FolderDialogProps {
  model: HierarchicalTrackSelectorModel
  /** e.g. "Tracks-Wiggle,My Subcategory" */
  categoryId: string
  /** display name of the category */
  title: string
  /** flat list of every track node under this category, recursively */
  subtracks: TreeTrackNode[]
  handleClose: () => void
}
// #endregion

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'TrackSelector-folderDialog': ComponentSlot<FolderDialogProps>
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

// Reads the *stored* mode rather than the resolved one, so a folder that an
// active filter has forced open still offers "Show as list". A top-level group
// row (a connection, or the config's own tracks) is what lazily loads a
// connection when clicked, so it can never become a folder.
function folderModeMenuItems(
  model: HierarchicalTrackSelectorModel,
  item: TreeCategoryNode,
) {
  const isFolder = model.categoryMode.get(item.id) === 'folder'
  return item.nestingLevel > 0
    ? [
        {
          label: isFolder ? 'Show as list' : 'Show as folder',
          onClick: () => {
            model.setFolderCategory(item.id, !isFolder)
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
      label: 'Add to selection',
      onClick: () => {
        model.addToSelection(trackNodes.map(n => n.trackId))
      },
    },
    {
      label: 'Remove from selection',
      onClick: () => {
        model.removeFromSelection(trackNodes.map(n => n.trackId))
      },
    },
    {
      label: 'Show all',
      onClick: () => {
        // sequential, so the tracks land in the order the category lists them
        // rather than the order their display chunks happen to resolve in
        void (async () => {
          for (const node of trackNodes) {
            await model.trackContainer?.launchTrack(node.trackId)
          }
        })()
      },
    },
    {
      label: 'Hide all',
      onClick: () => {
        for (const node of trackNodes) {
          model.trackContainer?.hideTrack(node.trackId)
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
  getDialogHost(model).queueDialog(handleClose => [
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
      {/* shown even at zero: an empty folder and a full one with nothing
      turned on are otherwise indistinguishable */}
      {stats ? (
        <span className={classes.countBadge}>
          ({stats.active}/{stats.total})
        </span>
      ) : null}
      <CascadingMenuButton
        className={classes.menuButton}
        data-testid={`htsCategoryMenu-${name}`}
        // no "Open as faceted selector..." — that is what clicking the row
        // does — and no subcategory items, since a folder draws none of them
        menuItems={() => [
          ...folderModeMenuItems(model, item),
          ...categoryTrackMenuItems(model, item),
        ]}
        stopPropagation
        setOpen={open => {
          setMenuOpen(open)
        }}
      >
        <MoreHorizGlyph />
      </CascadingMenuButton>
    </div>
  )
})

const NormalCategoryLabel = observer(function NormalCategoryLabel({
  item,
  model,
  expanded,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
  expanded: boolean
}) {
  const { classes } = useStyles()
  const { name, id } = item
  const { setMenuOpen, guard } = useMenuGuardedClick()
  // an active filter pins categories open, so a click here would rewrite the
  // stored mode with no visible effect
  const pinnedOpen = isFilterForcedOpen(item, model.filterActive)

  return (
    <div
      className={classes.accordionText}
      onClick={() => {
        guard(() => {
          if (!pinnedOpen) {
            model.toggleCategory(id)
          }
        })
      }}
    >
      <Typography data-testid={`htsCategory-${name}`}>
        {expanded ? <ArrowDropDownIcon /> : <ArrowRightIcon />}
        <SanitizedHTML html={name} />
        {item.loading ? (
          <CircularProgress size={12} className={classes.spinner} />
        ) : null}
        <CascadingMenuButton
          data-testid={`htsCategoryMenu-${name}`}
          menuItems={() => [
            ...folderModeMenuItems(model, item),
            {
              label: 'Open as faceted selector...',
              onClick: () => {
                openFolderDialog(model, item)
              },
            },
            ...categoryTrackMenuItems(model, item),
            ...subcategoryCollapseMenuItems(model, getAllSubcategories(item)),
          ]}
          className={classes.contrastColor}
          stopPropagation
          setOpen={open => {
            setMenuOpen(open)
          }}
        >
          <MoreHorizGlyph />
        </CascadingMenuButton>
      </Typography>
    </div>
  )
})

const TrackCategory = observer(function TrackCategory({
  item,
  model,
  mode,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
  mode: ResolvedCategoryMode
}) {
  return mode === 'folder' ? (
    <FolderCategoryLabel item={item} model={model} />
  ) : (
    <NormalCategoryLabel
      item={item}
      model={model}
      expanded={mode === 'expanded'}
    />
  )
})

export default TrackCategory
