import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession, mergeIntervals, toLocale } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { when } from 'mobx'

import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

function getExonsAndCDS(transcripts: Feature[]) {
  return transcripts.flatMap(
    transcript =>
      transcript
        .get('subfeatures')
        ?.filter(f => f.get('type') === 'exon' || f.get('type') === 'CDS') ??
      [],
  )
}

async function collapseIntrons({
  view,
  transcripts,
  assembly,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
}) {
  const r0 = transcripts[0]?.get('refName')
  if (!r0) {
    return
  }
  const refName = assembly.getCanonicalRefName2(r0)
  const padding = 100
  const subs = getExonsAndCDS(transcripts)
  const { id, ...rest } = getSnapshot(view)
  const newView = getSession(view).addView('LinearGenomeView', {
    ...rest,
    tracks: rest.tracks.map(({ id, ...r }) => r),
    displayedRegions: mergeIntervals(
      subs.map(f => ({
        refName,
        start: f.get('start') - padding,
        end: f.get('end') + padding,
        assemblyName: view.assemblyNames[0],
      })),
      padding,
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
  assembly: Assembly
  handleClose: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const initialCount = 10
  const sorted = [...transcripts].sort(
    (a, b) => b.get('end') - b.get('start') - (a.get('end') - a.get('start')),
  )
  const displayedTranscripts = showAll ? sorted : sorted.slice(0, initialCount)
  const hasMore = sorted.length > initialCount

  if (transcripts.length === 1) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    collapseIntrons({
      view,
      transcripts,
      assembly,
    })
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
        <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
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
              {displayedTranscripts.map((transcript, idx) => {
                const start = transcript.get('start')
                const end = transcript.get('end')
                const name =
                  transcript.get('name') ||
                  transcript.get('id') ||
                  `Transcript ${idx + 1}`
                const type = transcript.get('type') || 'transcript'
                const exonsAndCDS = getExonsAndCDS([transcript])
                const exonCount = exonsAndCDS.filter(
                  f => f.get('type') === 'exon',
                ).length
                const cdsCount = exonsAndCDS.length - exonCount

                return (
                  <TableRow key={transcript.id()}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{type}</TableCell>
                    <TableCell align="right">
                      {toLocale(end - start)} bp
                    </TableCell>
                    <TableCell align="right">{exonCount}</TableCell>
                    <TableCell align="right">{cdsCount}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={() => {
                          // eslint-disable-next-line @typescript-eslint/no-floating-promises
                          collapseIntrons({
                            view,
                            transcripts: [transcript],
                            assembly,
                          })
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
        </Box>
        {hasMore && !showAll ? (
          <Button
            onClick={() => {
              setShowAll(true)
            }}
          >
            Show all ({sorted.length} transcripts)
          </Button>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            collapseIntrons({
              view,
              transcripts,
              assembly,
            })
            handleClose()
          }}
        >
          Union of all transcripts
        </Button>
        <Button onClick={handleClose} variant="contained" color="secondary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
