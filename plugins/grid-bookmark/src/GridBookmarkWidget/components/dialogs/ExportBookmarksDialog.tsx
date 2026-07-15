import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import GetAppIcon from '@mui/icons-material/GetApp'
import { MenuItem, Select, Stack, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import BookmarkSelectionAlert from './BookmarkSelectionAlert.tsx'
import { downloadBookmarkFile } from '../../utils.ts'

import type { GridBookmarkModel } from '../../model.ts'

const ExportBookmarksDialog = observer(function ExportBookmarksDialog({
  model,
  onClose,
}: {
  model: GridBookmarkModel
  onClose: () => void
}) {
  const [fileType, setFileType] = useState('BED')
  const exportAll = model.selectedBookmarks.length === 0
  return (
    <SubmitDialog
      open
      title="Export bookmarks"
      submitText="Download"
      submitStartIcon={<GetAppIcon />}
      onCancel={onClose}
      onSubmit={() => {
        void downloadBookmarkFile(fileType, model)
        onClose()
      }}
    >
      <BookmarkSelectionAlert all={exportAll} verb="exported" />
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 1 }}>
        <Typography>Format to download:</Typography>
        <Select
          size="small"
          value={fileType}
          onChange={event => {
            setFileType(event.target.value)
          }}
        >
          <MenuItem value="BED">BED</MenuItem>
          <MenuItem value="TSV">TSV</MenuItem>
        </Select>
      </Stack>
    </SubmitDialog>
  )
})
export default ExportBookmarksDialog
