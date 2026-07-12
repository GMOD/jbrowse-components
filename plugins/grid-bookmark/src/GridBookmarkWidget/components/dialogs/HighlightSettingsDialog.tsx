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

import { getBookmarkSession } from '../../../bookmarkViewUtils.ts'

import type { GridBookmarkModel } from '../../model.ts'

const HighlightSettingsDialog = observer(function HighlightSettingsDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const session = getBookmarkSession(model)
  return (
    <Dialog open onClose={onClose} title="Settings">
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          <b>Bookmarks</b> are saved regions stored in your browser (via
          localStorage), listed in this widget, and can be exported and
          imported. <b>Highlights</b> are temporary colored regions that live in
          the current session only; they are not persisted and disappear when
          the session is closed unless converted to a bookmark.
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Switch
            data-testid="toggle_highlight_all_switch"
            checked={session.bookmarkHighlightsVisible}
            onChange={() => {
              session.setBookmarkHighlightsVisible(
                !session.bookmarkHighlightsVisible,
              )
            }}
          />
          <Typography>Show bookmarks as highlights on views</Typography>
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
