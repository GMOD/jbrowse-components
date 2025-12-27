import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { GridBookmarkModel } from '../../model'

const HighlightSettingsDialog = observer(function HighlightSettingsDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  return (
    <Dialog open onClose={onClose} title="Highlight bookmarks">
      <DialogContent>
        <Typography variant="h6">Highlight toggles</Typography>
        <Stack direction="row" alignItems="center">
          <Switch
            data-testid="toggle_highlight_all_switch"
            checked={model.areBookmarksHighlightedOnAllOpenViews}
            onChange={() => {
              model.setBookmarkHighlightsVisible(
                !model.areBookmarksHighlightedOnAllOpenViews,
              )
            }}
          />
          <Typography>Toggle bookmark highlights on all open views</Typography>
        </Stack>
        <Stack direction="row" alignItems="center">
          <Switch
            data-testid="toggle_highlight_label_all_switch"
            checked={model.areBookmarksHighlightLabelsOnAllOpenViews}
            onChange={() => {
              model.setBookmarkLabelsVisible(
                !model.areBookmarksHighlightLabelsOnAllOpenViews,
              )
            }}
          />
          <Typography>Toggle 'bookmark' icon on LGV tracks</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            onClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default HighlightSettingsDialog
