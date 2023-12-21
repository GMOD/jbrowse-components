import React, { lazy } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'
import { Alert } from '@mui/material'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// locals
import BookmarkGrid from './BookmarkGrid'
import AssemblySelector from './AssemblySelector'
import { GridBookmarkModel } from '../model'

// icons
import Menu from '@mui/icons-material/Menu'
import GetApp from '@mui/icons-material/GetApp'
import Publish from '@mui/icons-material/Publish'
import Settings from '@mui/icons-material/Settings'
import Palette from '@mui/icons-material/Palette'
import Share from '@mui/icons-material/Share'
import Delete from '@mui/icons-material/Delete'

// lazies
const ExportBookmarksDialog = lazy(
  () => import('./dialogs/ExportBookmarksDialog'),
)
const ImportBookmarksDialog = lazy(
  () => import('./dialogs/ImportBookmarksDialog'),
)
const ShareBookmarksDialog = lazy(
  () => import('./dialogs/ShareBookmarksDialog'),
)
const HighlightSettingsDialog = lazy(
  () => import('./dialogs/HighlightSettingsDialog'),
)
const EditHighlightColorDialog = lazy(
  () => import('./dialogs/EditHighlightColorDialog'),
)
const DeleteBookmarksDialog = lazy(
  () => import('./dialogs/DeleteBookmarksDialog'),
)

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
  },
})

const GridBookmarkWidget = observer(function GridBookmarkWidget({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()

  if (!model) {
    return null
  }

  return (
    <div>
      <Alert severity="info">
        Click and type within the <strong>label</strong> field to annotate your
        bookmark. Double click the <strong>label</strong> field to do so within
        a dialog.
      </Alert>
      <div className={classes.flex}>
        <CascadingMenuButton
          data-testid="grid_bookmark_menu"
          menuItems={[
            {
              label: 'Export',
              icon: GetApp,
              onClick: () => {
                getSession(model).queueDialog(onClose => [
                  ExportBookmarksDialog,
                  { onClose, model },
                ])
              },
            },
            {
              label: 'Import',
              icon: Publish,
              onClick: () => {
                getSession(model).queueDialog(onClose => [
                  ImportBookmarksDialog,
                  { model, onClose },
                ])
              },
            },
            {
              label: 'Delete',
              icon: Delete,
              onClick: () => {
                getSession(model).queueDialog(onClose => [
                  DeleteBookmarksDialog,
                  { model, onClose },
                ])
              },
            },
            {
              label: 'Share',
              icon: Share,
              onClick: () => {
                getSession(model).queueDialog(onClose => [
                  ShareBookmarksDialog,
                  { model, onClose },
                ])
              },
            },
            {
              label: 'Edit colors',
              icon: Palette,
              onClick: () => {
                getSession(model).queueDialog(onClose => [
                  EditHighlightColorDialog,
                  { model, onClose },
                ])
              },
            },
            {
              label: 'Settings',
              icon: Settings,
              onClick: () => {
                getSession(model).queueDialog(onClose => [
                  HighlightSettingsDialog,
                  { model, onClose },
                ])
              },
            },
          ]}
        >
          <Menu />
        </CascadingMenuButton>

        <AssemblySelector model={model} />
      </div>
      <BookmarkGrid model={model} />
    </div>
  )
})

export default GridBookmarkWidget
