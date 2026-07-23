import { useState } from 'react'

import { SAM_FLAG_SECONDARY, variantsToVcf } from '@jbrowse/alignments-core'
import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import {
  CopyToClipboardButton,
  Dialog,
  ErrorBanner,
  LoadingEllipses,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import {
  addAndShowTrack,
  getRpcSessionId,
  getSession,
  isSessionWithAddTracks,
  toLocale,
  useFetch,
} from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { defaultFilterFlags } from '../shared/util.ts'
import FractionSlider from './FractionSlider.tsx'

import type { FilterBy } from '../shared/types.ts'
import type { ConsensusVariant } from '@jbrowse/alignments-core'
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
  const [minDepth, setMinDepth] = useState(1)
  const [callFract, setCallFract] = useState(0.75)
  const [ambiguityCodes, setAmbiguityCodes] = useState(false)
  const [hetFract, setHetFract] = useState(0.5)
  const [includeInsertions, setIncludeInsertions] = useState(true)
  const [excludeSecondary, setExcludeSecondary] = useState(true)

  // The track's active filterBy flows through, but its default keeps secondary
  // alignments, unlike samtools. Toggle the SECONDARY bit on the fetch's
  // flagExclude so the consensus matches samtools by default while letting the
  // user opt back in — clearing the bit (not just omitting filterBy) so
  // unchecking actually includes secondary even when the track already excluded
  // them.
  const base = display.filterBy ?? defaultFilterFlags
  const filterBy = {
    ...base,
    flagExclude: excludeSecondary
      ? base.flagExclude | SAM_FLAG_SECONDARY
      : base.flagExclude & ~SAM_FLAG_SECONDARY,
  }

  const totalBp = regions.reduce((a, r) => a + (r.end - r.start), 0)
  const tooLargeToFetch = totalBp > MAX_CONSENSUS_BP

  // undefined hetFract is what turns ambiguity off in computeConsensus
  const effectiveHetFract = ambiguityCodes ? hetFract : undefined

  const { data, error } = useFetch(
    tooLargeToFetch
      ? false
      : [
          'getConsensus',
          regions.map(r => `${r.refName}:${r.start}-${r.end}`),
          display.adapterConfig,
          filterBy,
          minDepth,
          callFract,
          ambiguityCodes,
          hetFract,
          includeInsertions,
        ],
    async () => {
      const session = getSession(model)
      const sessionId = getRpcSessionId(display)
      const results = await Promise.all(
        regions.map(async region => {
          const sequenceAdapter = getSequenceAdapterConfig(
            region.assemblyName
              ? session.assemblyManager.get(region.assemblyName)
              : undefined,
          )
          const { consensus, variants } = (await session.rpcManager.call(
            sessionId,
            'GetConsensusSequence',
            {
              adapterConfig: display.adapterConfig,
              sequenceAdapter,
              regions: [region],
              filterBy,
              minDepth,
              callFract,
              hetFract: effectiveHetFract,
              includeInsertions,
            },
          )) as { consensus: string; variants: ConsensusVariant[] }
          return {
            header: `${region.refName}:${region.start + 1}-${region.end} consensus`,
            seq: consensus,
            refName: region.refName,
            variants,
          }
        }),
      )
      return {
        records: results.map(r => ({ header: r.header, seq: r.seq })),
        vcfEntries: results.map(r => ({
          refName: r.refName,
          variants: r.variants,
        })),
      }
    },
  )

  const loading = !tooLargeToFetch && data === undefined && !error
  const sequence = data ? formatSeqFasta(data.records) : ''
  const vcf = data ? variantsToVcf(data.vcfEntries) : ''
  const variantCount = data
    ? data.vcfEntries.reduce((a, e) => a + e.variants.length, 0)
    : 0
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
        <Typography variant="body2" color="text.secondary" gutterBottom>
          At each position the reads &quot;vote&quot; for a base, matching
          samtools consensus. With ambiguity codes on, a position where the
          reads disagree reports an IUPAC code (e.g. R for A-or-G) instead of N,
          and unlike samtools it is not capped at two alleles, so pooled or
          higher-ploidy samples can show a real 3- or 4-way split.
        </Typography>
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <TextField
            label="Min read depth"
            helperText="positions covered by fewer reads than this are N, regardless of agreement"
            type="number"
            size="small"
            value={minDepth}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            onChange={event => {
              const v = Number.parseInt(event.target.value, 10)
              setMinDepth(Number.isFinite(v) && v >= 1 ? v : 1)
            }}
          />
          <FractionSlider
            label="Min call fraction"
            helpText="the called base(s) must together account for at least this fraction of the reads, or it's N"
            value={callFract}
            onCommit={v => {
              setCallFract(v)
            }}
          />
          <FractionSlider
            label="Min het fraction"
            helpText="with ambiguity codes on, a base joins the call if its support is at least this fraction of the top base's (lower = more IUPAC codes)"
            value={hetFract}
            onCommit={v => {
              setHetFract(v)
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={ambiguityCodes}
                onChange={event => {
                  setAmbiguityCodes(event.target.checked)
                }}
              />
            }
            label="IUPAC ambiguity codes"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={includeInsertions}
                onChange={event => {
                  setIncludeInsertions(event.target.checked)
                }}
              />
            }
            label="Include insertions"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={excludeSecondary}
                onChange={event => {
                  setExcludeSecondary(event.target.checked)
                }}
              />
            }
            label="Exclude secondary alignments"
          />
        </div>
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
        <Typography variant="caption" color="text.secondary">
          Variants are simply the positions where this consensus differs from
          the reference. Base qualities are not used and the output has no
          genotypes or quality scores, so use a variant caller if you need
          those. Positions called N or an ambiguity code are left out.
        </Typography>
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
          variant="contained"
          onClick={async () => {
            const { saveAs } = await import('@jbrowse/core/util')
            saveAs(
              new Blob([vcf], { type: 'text/plain;charset=utf-8' }),
              'jbrowse_consensus.vcf',
            )
          }}
          disabled={loading || !!error || tooLargeToFetch || !variantCount}
          color="primary"
          startIcon={<GetAppIcon />}
        >
          Download VCF ({variantCount})
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            const session = getSession(model)
            if (!isSessionWithAddTracks(session)) {
              session.notify('This session cannot add tracks', 'warning')
              return
            }
            const region = regions[0]!
            addAndShowTrack(
              session,
              {
                type: 'VariantTrack',
                trackId: `consensus-variants-${Date.now()}`,
                name: `Consensus variants ${region.refName}:${region.start + 1}-${region.end}`,
                assemblyNames: [region.assemblyName],
                adapter: {
                  type: 'VcfAdapter',
                  vcfLocation: {
                    locationType: 'UriLocation',
                    uri: `data:text/plain;base64,${btoa(vcf)}`,
                  },
                },
              },
              model,
            )
            handleClose()
          }}
          disabled={loading || !!error || tooLargeToFetch || !variantCount}
          color="primary"
          startIcon={<AddIcon />}
        >
          Open as variant track
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
