import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getDialogHost, getSession } from '@jbrowse/core/util'
import GetApp from '@mui/icons-material/GetApp'
import Menu from '@mui/icons-material/Menu'
import Publish from '@mui/icons-material/Publish'
import { Stack } from '@mui/material'
import { observer } from 'mobx-react'

import HighlightGrid from './HighlightGrid.tsx'

import type { GridBookmarkModel } from '../model.ts'

// lazies
const ExportHighlightsDialog = lazy(
  () => import('./dialogs/ExportHighlightsDialog.tsx'),
)
const ImportHighlightsDialog = lazy(
  () => import('./dialogs/ImportHighlightsDialog.tsx'),
)

const GridBookmarkWidget = observer(function GridBookmarkWidget({
  model,
}: {
  model: GridBookmarkModel
}) {
  const session = getSession(model)
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
                getDialogHost(model).queueDialog(onClose => [
                  ExportHighlightsDialog,
                  { onClose, model },
                ])
              },
            },
            {
              label: 'Import',
              icon: Publish,
              onClick: () => {
                getDialogHost(model).queueDialog(onClose => [
                  ImportHighlightsDialog,
                  { model, onClose },
                ])
              },
            },
            {
              label: 'Show highlights on views',
              type: 'checkbox',
              checked: session.highlightsVisible,
              onClick: () => {
                session.setHighlightsVisible(!session.highlightsVisible)
              },
            },
          ]}
        >
          <Menu />
        </CascadingMenuButton>
      </Stack>
      <HighlightGrid model={model} />
    </div>
  )
})

export default GridBookmarkWidget
