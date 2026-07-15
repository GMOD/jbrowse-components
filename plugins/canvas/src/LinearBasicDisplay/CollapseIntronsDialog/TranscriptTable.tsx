import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { observer } from 'mobx-react'

import IntronActionButtons from './IntronActionButtons.tsx'
import { getExonsAndCDS } from './util.ts'
import { getFeatureName } from '../../RenderFeatureDataRPC/labelUtils.ts'
import { isExon } from '../../RenderFeatureDataRPC/util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  scrollContainer: {
    maxHeight: 600,
    overflow: 'auto',
  },
})

interface TranscriptRow {
  transcript: Feature
  name: string
  type: string
  lengthBp: number
  exonCount: number
  cdsCount: number
}

function buildRows(transcripts: Feature[]): TranscriptRow[] {
  return transcripts
    .map(transcript => {
      const start = transcript.get('start')
      const end = transcript.get('end')
      const exonsAndCDS = getExonsAndCDS([transcript])
      const exonCount = exonsAndCDS.filter(f => isExon(f)).length
      return {
        transcript,
        name: getFeatureName(transcript),
        type: transcript.get('type') || 'transcript',
        lengthBp: end - start,
        exonCount,
        cdsCount: exonsAndCDS.length - exonCount,
      }
    })
    .sort((a, b) => b.lengthBp - a.lengthBp)
    .map((row, idx) => ({
      ...row,
      // Ordinal fallback for unnamed transcripts, assigned AFTER the length
      // sort so "Transcript 1, 2, ..." reads top-to-bottom in the table.
      name: row.name ?? `Transcript ${idx + 1}`,
    }))
}

const TranscriptTable = observer(function TranscriptTable({
  transcripts,
  view,
  assembly,
  windowSize,
  flip,
  canLaunchView,
  handleClose,
  trackId,
  soloFeatureId,
}: {
  transcripts: Feature[]
  view: LinearGenomeViewModel
  assembly: Assembly
  windowSize: number | undefined
  flip: boolean
  canLaunchView: boolean
  handleClose: () => void
  trackId: string
  soloFeatureId: string | undefined
}) {
  const { classes } = useStyles()
  const rows = buildRows(transcripts)

  return (
    <Box className={classes.scrollContainer}>
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
          {rows.map(row => (
            <TableRow key={row.transcript.id()}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.type}</TableCell>
              <TableCell align="right">{toLocale(row.lengthBp)} bp</TableCell>
              <TableCell align="right">{row.exonCount}</TableCell>
              <TableCell align="right">{row.cdsCount}</TableCell>
              <TableCell align="right">
                <IntronActionButtons
                  view={view}
                  transcripts={[row.transcript]}
                  assembly={assembly}
                  windowSize={windowSize}
                  flip={flip}
                  canLaunchView={canLaunchView}
                  handleClose={handleClose}
                  trackId={trackId}
                  soloFeatureId={soloFeatureId}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
})

export default TranscriptTable
