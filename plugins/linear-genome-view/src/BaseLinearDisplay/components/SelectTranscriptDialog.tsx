import { Dialog } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'

import type { Feature } from '@jbrowse/core/util'

export default function SelectTranscriptDialog({
  transcripts,
  onSelect,
  handleClose,
}: {
  transcripts: Feature[]
  onSelect: (transcript: Feature) => void
  handleClose: () => void
}) {
  const sorted = [...transcripts].sort(
    (a, b) => b.get('end') - b.get('start') - (a.get('end') - a.get('start')),
  )

  return (
    <Dialog
      open
      maxWidth="md"
      onClose={handleClose}
      title="Select transcript to collapse"
    >
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name/ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Length</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((transcript, idx) => {
              const start = transcript.get('start')
              const end = transcript.get('end')
              const length = end - start
              const name =
                transcript.get('name') || transcript.get('id') || `Transcript ${idx + 1}`
              const type = transcript.get('type') || 'transcript'

              return (
                <TableRow key={transcript.id()}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{type}</TableCell>
                  <TableCell align="right">{toLocale(length)} bp</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        onSelect(transcript)
                        handleClose()
                      }}
                    >
                      Select
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
