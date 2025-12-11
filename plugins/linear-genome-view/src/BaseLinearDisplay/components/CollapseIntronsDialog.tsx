import { Dialog } from '@jbrowse/core/ui'
import { getSession, mergeIntervals, toLocale } from '@jbrowse/core/util'
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
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

async function collapseIntrons({
  view,
  transcript,
  assembly,
}: {
  view: LinearGenomeViewModel
  transcript: Feature
  assembly?: Assembly
}) {
  const r0 = transcript.get('refName')
  const refName = assembly?.getCanonicalRefName(r0) || r0
  const w = 100

  const subs =
    transcript
      .get('subfeatures')
      ?.filter(f => f.get('type') === 'exon' || f.get('type') === 'CDS') ?? []

  const { id, ...rest } = getSnapshot(view)
  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: rest.tracks.map(track => {
      const { id, ...rest } = track
      return { ...rest }
    }),
    displayedRegions: mergeIntervals(
      subs.map(f => ({
        refName,
        start: f.get('start') - w,
        end: f.get('end') + w,
        assemblyName: view.assemblyNames[0],
      })),
      w,
    ),
  }) as LinearGenomeViewModel
  await when(() => newView.initialized)

  newView.showAllRegions()
}

export default function CollapseIntronsDialog({
  view,
  transcripts,
  assembly,
  handleClose,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly?: Assembly
  handleClose: () => void
}) {
  const sorted = [...transcripts].sort(
    (a, b) => b.get('end') - b.get('start') - (a.get('end') - a.get('start')),
  )

  if (transcripts.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    collapseIntrons({ view, transcript: transcripts[0]!, assembly })
    handleClose()
    return null
  }

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
              <TableCell align="right">Exons</TableCell>
              <TableCell align="right">CDS</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((transcript, idx) => {
              const start = transcript.get('start')
              const end = transcript.get('end')
              const length = end - start
              const name =
                transcript.get('name') ||
                transcript.get('id') ||
                `Transcript ${idx + 1}`
              const type = transcript.get('type') || 'transcript'
              const subfeatures = transcript.get('subfeatures') ?? []
              const exonCount = subfeatures.filter(
                f => f.get('type') === 'exon',
              ).length
              const cdsCount = subfeatures.filter(
                f => f.get('type') === 'CDS',
              ).length

              return (
                <TableRow key={transcript.id()}>
                  <TableCell>{name}</TableCell>
                  <TableCell>{type}</TableCell>
                  <TableCell align="right">{toLocale(length)} bp</TableCell>
                  <TableCell align="right">{exonCount}</TableCell>
                  <TableCell align="right">{cdsCount}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        // eslint-disable-next-line @typescript-eslint/no-floating-promises
                        collapseIntrons({ view, transcript, assembly })
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
