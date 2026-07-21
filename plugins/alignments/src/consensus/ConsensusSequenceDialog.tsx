import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import { getRpcSessionId, getSession, toLocale, useFetch } from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { FilterBy } from '../shared/types.ts'
import type { Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// Reads are far heavier than a plain reference fetch, so refuse a whole-
// chromosome consensus outright rather than round-tripping megabases of
// alignments into the worker.
const MAX_CONSENSUS_BP = 500_000
const MAX_DISPLAY_BP = 1_000_000

interface ConsensusDisplay extends IAnyStateTreeNode {
  adapterConfig: Record<string, unknown>
  filterBy?: FilterBy
}

const ConsensusSequenceDialog = observer(function ConsensusSequenceDialog({
  model,
  display,
  regions,
  handleClose,
}: {
  model: IAnyStateTreeNode
  display: ConsensusDisplay
  regions: Region[]
  handleClose: () => void
}) {
  const totalBp = regions.reduce((a, r) => a + (r.end - r.start), 0)
  const tooLargeToFetch = totalBp > MAX_CONSENSUS_BP

  const { data: records, error } = useFetch(
    tooLargeToFetch
      ? false
      : [
          'getConsensus',
          regions.map(r => `${r.refName}:${r.start}-${r.end}`),
          display.adapterConfig,
          display.filterBy,
        ],
    async () => {
      const session = getSession(model)
      const sessionId = getRpcSessionId(display)
      return Promise.all(
        regions.map(async region => {
          const sequenceAdapter = getSequenceAdapterConfig(
            region.assemblyName
              ? session.assemblyManager.get(region.assemblyName)
              : undefined,
          )
          const { consensus } = (await session.rpcManager.call(
            sessionId,
            'GetConsensusSequence',
            {
              adapterConfig: display.adapterConfig,
              sequenceAdapter,
              regions: [region],
              filterBy: display.filterBy,
            },
          )) as { consensus: string }
          return {
            header: `${region.refName}:${region.start + 1}-${region.end} consensus`,
            seq: consensus,
          }
        }),
      )
    },
  )

  const loading = !tooLargeToFetch && records === undefined && !error
  const sequence = records ? formatSeqFasta(records) : ''
  const sequenceTooLarge = sequence.length > MAX_DISPLAY_BP

  return (
    <Dialog
      maxWidth="xl"
      open
      title="Consensus sequence"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent style={{ width: '80em' }}>
        {tooLargeToFetch ? (
          <ErrorBanner
            error={
              new Error(
                `Selected region (${toLocale(totalBp)}bp) is too large for a consensus; select up to ${toLocale(MAX_CONSENSUS_BP)}bp.`,
              )
            }
          />
        ) : error ? (
          <ErrorBanner error={error} />
        ) : loading ? (
          <LoadingEllipses message="Computing consensus" />
        ) : null}
        <MonospaceTextField
          fullWidth
          readOnly
          minRows={5}
          maxRows={10}
          disabled={sequenceTooLarge}
          value={
            sequenceTooLarge
              ? 'Consensus sequence too large to display, use the download FASTA button'
              : sequence
          }
        />
      </DialogContent>
      <DialogActions>
        <CopyToClipboardButton
          value={sequence}
          copiedLabel="Copied"
          disabled={loading || !!error || sequenceTooLarge || tooLargeToFetch}
          color="primary"
          startIcon={<ContentCopyIcon />}
        >
          Copy to clipboard
        </CopyToClipboardButton>
        <Button
          variant="contained"
          onClick={async () => {
            const { saveAs } = await import('@jbrowse/core/util')
            saveAs(
              new Blob([sequence], { type: 'text/x-fasta;charset=utf-8' }),
              'jbrowse_consensus.fa',
            )
          }}
          disabled={loading || !!error || tooLargeToFetch}
          color="primary"
          startIcon={<GetAppIcon />}
        >
          Download FASTA
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ConsensusSequenceDialog
