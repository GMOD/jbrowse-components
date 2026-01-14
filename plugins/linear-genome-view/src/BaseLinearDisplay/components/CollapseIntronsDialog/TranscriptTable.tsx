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

import { collapseIntrons, getExonsAndCDS } from './util.ts'

import type { LinearGenomeViewModel } from '../../../LinearGenomeView/index.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'

export default function TranscriptTable({
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
                      ;(async () => {
                        try {
                          await collapseIntrons({
                            view,
                            transcripts: [transcript],
                            assembly,
                            padding,
                          })
                          handleClose()
                        } catch (e) {
                          getSession(view).notifyError(`${e}`, e)
                          console.error(e)
                        }
                      })()
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
