import { getSession, toLocale } from '@jbrowse/core/util'
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'

import { collapseIntrons, getExonsAndCDS, replaceIntrons } from './util.ts'
import { isExon } from '../../RenderFeatureDataRPC/util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
    .map((transcript, idx) => {
      const start = transcript.get('start')
      const end = transcript.get('end')
      const exonsAndCDS = getExonsAndCDS([transcript])
      const exonCount = exonsAndCDS.filter(f => isExon(f)).length
      return {
        transcript,
        name:
          transcript.get('name') ||
          transcript.get('id') ||
          `Transcript ${idx + 1}`,
        type: transcript.get('type') || 'transcript',
        lengthBp: end - start,
        exonCount,
        cdsCount: exonsAndCDS.length - exonCount,
      }
    })
    .sort((a, b) => b.lengthBp - a.lengthBp)
}

export default function TranscriptTable({
  transcripts,
  view,
  assembly,
  padding,
  validPadding,
  canLaunchView,
  handleClose,
}: {
  transcripts: Feature[]
  view: LinearGenomeViewModel
  assembly: Assembly
  padding: number
  validPadding: boolean
  canLaunchView: boolean
  handleClose: () => void
}) {
  const rows = buildRows(transcripts)

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
          {rows.map(row => (
            <TableRow key={row.transcript.id()}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.type}</TableCell>
              <TableCell align="right">{toLocale(row.lengthBp)} bp</TableCell>
              <TableCell align="right">{row.exonCount}</TableCell>
              <TableCell align="right">{row.cdsCount}</TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  disabled={!validPadding}
                  onClick={() => {
                    try {
                      replaceIntrons({
                        view,
                        transcripts: [row.transcript],
                        assembly,
                        padding,
                      })
                      handleClose()
                    } catch (e) {
                      getSession(view).notifyError(`${e}`, e)
                      console.error(e)
                    }
                  }}
                >
                  Replace
                </Button>
                {canLaunchView ? (
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    disabled={!validPadding}
                    onClick={async () => {
                      try {
                        await collapseIntrons({
                          view,
                          transcripts: [row.transcript],
                          assembly,
                          padding,
                        })
                        handleClose()
                      } catch (e) {
                        getSession(view).notifyError(`${e}`, e)
                        console.error(e)
                      }
                    }}
                  >
                    Launch
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}
