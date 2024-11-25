import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogContent,
  DialogActions,
  Stack,
  Typography,
  Switch,
} from '@mui/material'
import { observer } from 'mobx-react'

// locals
import type { GridBookmarkModel } from '../../model'

const HighlightSettingsDialog = observer(function ({
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
              model.setHighlightToggle(
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
              model.setLabelToggle(
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
