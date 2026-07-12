import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import GetApp from '@mui/icons-material/GetApp'
import LocalOffer from '@mui/icons-material/LocalOffer'
import Menu from '@mui/icons-material/Menu'
import Publish from '@mui/icons-material/Publish'
import Settings from '@mui/icons-material/Settings'
import { Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { observer } from 'mobx-react'

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
const HighlightSettingsDialog = lazy(
  () => import('./dialogs/HighlightSettingsDialog.tsx'),
)

const GridBookmarkWidget = observer(function GridBookmarkWidget({
  model,
}: {
  model: GridBookmarkModel
}) {
  return (
    <div>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pt: 4 }}>
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
              label: 'Show highlight chips',
              icon: LocalOffer,
              type: 'checkbox',
              checked: model.areHighlightChipsShownOnAllOpenViews,
              onClick: () => {
                model.setShowHighlightChips(
                  !model.areHighlightChipsShownOnAllOpenViews,
                )
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
          <ToggleButton value="both">Both</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {model.gridView !== 'highlights' ? <BookmarkGrid model={model} /> : null}
      {model.gridView !== 'bookmarks' ? <HighlightGrid model={model} /> : null}
    </div>
  )
})

export default GridBookmarkWidget
