import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import GetAppIcon from '@mui/icons-material/GetApp'
import { Alert, MenuItem, Select, Stack, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { downloadHighlightFile } from '../../utils.ts'

import type { GridBookmarkModel } from '../../model.ts'

const ExportHighlightsDialog = observer(function ExportHighlightsDialog({
  model,
  onClose,
}: {
  model: GridBookmarkModel
  onClose: () => void
}) {
  const [fileType, setFileType] = useState('BED')
  const { selectedHighlights, rows } = model
  const exportAll = selectedHighlights.length === 0
  return (
    <SubmitDialog
      open
      title="Export highlights"
      submitText="Download"
      submitStartIcon={<GetAppIcon />}
      onCancel={onClose}
      onSubmit={() => {
        void downloadHighlightFile(
          fileType,
          exportAll ? rows.map(r => r.highlight) : selectedHighlights,
        )
        onClose()
      }}
    >
      <Alert severity="info">
        {exportAll
          ? 'All highlights will be exported. Use the checkboxes to export only some.'
          : 'Only the selected highlights will be exported.'}
      </Alert>
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
export default ExportHighlightsDialog
