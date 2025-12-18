import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession, mergeIntervals, toLocale } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
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
  padding,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  padding: number
}) {
  const r0 = transcripts[0]?.get('refName')
  if (!r0) {
    return
  }
  const refName = assembly.getCanonicalRefName2(r0)
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

function TranscriptTable({
  transcripts,
  view,
  assembly,
  padding,
  validPadding,
  handleClose,
}: {
  transcripts: Feature[]
  view: LinearGenomeViewModel
  assembly: Assembly
  padding: number
  validPadding: boolean
  handleClose: () => void
}) {
  const sorted = [...transcripts].sort((a, b) => {
    const lenA = a.get('end') - a.get('start')
    const lenB = b.get('end') - b.get('start')
    return lenB - lenA
  })

  return (
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
          {sorted.map((transcript, idx) => {
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
                <TableCell align="right">{toLocale(end - start)} bp</TableCell>
                <TableCell align="right">{exonCount}</TableCell>
                <TableCell align="right">{cdsCount}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    disabled={!validPadding}
                    onClick={() => {
                      // eslint-disable-next-line @typescript-eslint/no-floating-promises
                      collapseIntrons({
                        view,
                        transcripts: [transcript],
                        assembly,
                        padding,
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
  )
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
  const [windowSize, setWindowSize] = useState('100')
  const windowSizeNum = +windowSize
  const validWindowSize = !Number.isNaN(windowSizeNum) && windowSizeNum >= 0

  return (
    <Dialog
      open
      maxWidth="md"
      onClose={handleClose}
      title="Select transcript to collapse"
    >
      <DialogContent>
        <DialogContentText>
          <p>
            Select the 'window size' which will be the extra space surrounding
            splice boundary to include. 10bp will only include a small 10bp
            region around splice boundary
          </p>
          <p>
            By default the union of exons from all transcripts will be used to
            create the collapsed intron view, but you can optionally use the
            exons of only a specific transcript by clicking "Show all
            transcripts" and then "Select"
          </p>
        </DialogContentText>
        <TextField
          label="Number of bp around splice site to include"
          value={windowSize}
          onChange={event => {
            setWindowSize(event.target.value)
          }}
          error={windowSize !== '' && !validWindowSize}
          helperText={
            windowSize !== '' && !validWindowSize
              ? 'Must be a non-negative number'
              : ''
          }
          type="number"
          slotProps={{
            htmlInput: {
              min: 0,
              step: 10,
            },
          }}
          style={{ marginBottom: 16, width: 250 }}
        />
        <Button
          style={{ float: 'right' }}
          onClick={() => {
            setShowAll(s => !s)
          }}
        >
          {!showAll ? 'Show' : 'Hide'} all transcripts ({transcripts.length})
        </Button>
        {showAll ? (
          <TranscriptTable
            transcripts={transcripts}
            view={view}
            assembly={assembly}
            padding={windowSizeNum}
            validPadding={validWindowSize}
            handleClose={handleClose}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={!validWindowSize}
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            collapseIntrons({
              view,
              transcripts,
              assembly,
              padding: windowSizeNum,
            })
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button onClick={handleClose} variant="contained" color="secondary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
