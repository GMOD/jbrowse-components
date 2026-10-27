import { useState } from 'react'

import { ErrorBanner, SubmitDialog } from '@jbrowse/core/ui'
import GetAppIcon from '@mui/icons-material/GetApp'
import { Alert, MenuItem, Select, Stack, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { downloadHighlightFile } from '../../utils.ts'

import type { GridBookmarkModel } from '../../model.ts'
import type { HighlightFileFormat } from '../../utils.ts'

const ExportHighlightsDialog = observer(function ExportHighlightsDialog({
  model,
  onClose,
}: {
  model: GridBookmarkModel
  onClose: () => void
}) {
  const [fileType, setFileType] = useState<HighlightFileFormat>('BED')
  const [error, setError] = useState<unknown>()
  const { selectedHighlights, rows } = model
  const exportAll = selectedHighlights.length === 0
  const highlights = exportAll ? rows.map(r => r.highlight) : selectedHighlights
  const assemblyCount = new Set(highlights.map(h => h.assemblyName)).size
  return (
    <SubmitDialog
      open
      title="Export highlights"
      submitText="Download"
      submitStartIcon={<GetAppIcon />}
      onCancel={onClose}
      onSubmit={async () => {
        try {
          await downloadHighlightFile(fileType, highlights)
          onClose()
        } catch (e) {
          console.error(e)
          setError(e)
        }
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
      {fileType === 'BED' && assemblyCount > 1 ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          A BED file holds one assembly, so this downloads {assemblyCount}{' '}
          files. TSV keeps every assembly in one file.
        </Alert>
      ) : null}
      {error ? <ErrorBanner error={error} /> : null}
    </SubmitDialog>
  )
})
export default ExportHighlightsDialog
