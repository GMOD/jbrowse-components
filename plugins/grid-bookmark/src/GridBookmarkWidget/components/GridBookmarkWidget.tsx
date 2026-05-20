import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import Delete from '@mui/icons-material/Delete'
import GetApp from '@mui/icons-material/GetApp'
import Menu from '@mui/icons-material/Menu'
import Palette from '@mui/icons-material/Palette'
import Publish from '@mui/icons-material/Publish'
import Settings from '@mui/icons-material/Settings'
import Share from '@mui/icons-material/Share'
import { Alert, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

import AssemblySelector from './AssemblySelector.tsx'
import BookmarkGrid from './BookmarkGrid.tsx'
import HighlightGrid from './HighlightGrid.tsx'

import type { GridBookmarkModel } from '../model.ts'

// lazies
const ExportBookmarksDialog = lazy(
  () => import('./dialogs/ExportBookmarksDialog.tsx'),
)
const ImportBookmarksDialog = lazy(
  () => import('./dialogs/ImportBookmarksDialog.tsx'),
)
const ShareBookmarksDialog = lazy(
  () => import('./dialogs/ShareBookmarksDialog.tsx'),
)
const HighlightSettingsDialog = lazy(
  () => import('./dialogs/HighlightSettingsDialog.tsx'),
)
const EditHighlightColorDialog = lazy(
  () => import('./dialogs/EditHighlightColorDialog.tsx'),
)
const DeleteBookmarksDialog = lazy(
  () => import('./dialogs/DeleteBookmarksDialog.tsx'),
)

const GridBookmarkWidget = observer(function GridBookmarkWidget({
  model,
}: {
  model: GridBookmarkModel
}) {
  return (
    <div>
      <Alert severity="info">
        Click and type within the <strong>label</strong> field to annotate your
        bookmark
      </Alert>
      <Stack direction="row" spacing={1} alignItems="center">
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
        <ToggleButtonGroup
          size="small"
          exclusive
          value={model.gridView}
          onChange={(_event, value) => {
            if (value) {
              model.setGridView(value)
            }
          }}
        >
          <ToggleButton value="bookmarks">Bookmarks</ToggleButton>
          <ToggleButton value="highlights">Highlights</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {model.gridView === 'bookmarks' ? (
        <BookmarkGrid model={model} />
      ) : (
        <HighlightGrid model={model} />
      )}
    </div>
  )
})

export default GridBookmarkWidget
