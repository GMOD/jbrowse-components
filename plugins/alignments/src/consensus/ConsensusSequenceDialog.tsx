import { useState } from 'react'

import { variantsToVcf } from '@jbrowse/alignments-core'
import { SAM_FLAG_SECONDARY } from '@jbrowse/cigar-utils'
import {
  CopyToClipboardButton,
  ErrorBanner,
  ExternalLink,
  InfoDialog,
  LabeledCheckbox,
  LoadingEllipses,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import {
  addAndShowTrack,
  assembleLocString,
  createStatusFanOut,
  getRpcSessionId,
  getSession,
  isSessionWithAddSessionTrack,
  locStringsToRegions,
  saveAs,
  statusProgressLabel,
  toLocale,
} from '@jbrowse/core/util'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'
import { useDebounce } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import { Button, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { defaultFilterFlags } from '../shared/util.ts'
import ConsensusSettingsPanel from './ConsensusSettingsPanel.tsx'
import { useConsensusSettings } from './useConsensusSettings.ts'

import type { FilterBy } from '../shared/types.ts'
import type { ConsensusVcfEntry } from '@jbrowse/alignments-core'
import type { Region } from '@jbrowse/core/util'
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
} from '@jbrowse/mobx-state-tree'

// Reads are far heavier than a plain reference fetch, so refuse a whole-
// chromosome consensus outright rather than round-tripping megabases of
// alignments into the worker.
const MAX_CONSENSUS_BP = 500_000
const MAX_DISPLAY_BP = 1_000_000

function download(content: string, filename: string, type: string) {
  saveAs(new Blob([content], { type }), filename)
}

export interface ConsensusDisplay extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  filterBy?: FilterBy
}

interface ConsensusData {
  records: { header: string; seq: string }[]
  vcfEntries: ConsensusVcfEntry[]
}

const ConsensusSequenceDialog = observer(function ConsensusSequenceDialog({
  model,
  display,
  trackName,
  regions: selectedRegions,
  handleClose,
}: {
  model: IAnyStateTreeNode
  display: ConsensusDisplay
  trackName: string
  regions: Region[]
  handleClose: () => void
}) {
  const session = getSession(model)
  const assemblyName = selectedRegions[0]!.assemblyName
  const assembly = session.assemblyManager.get(assemblyName)
  const [locStrings, setLocStrings] = useState(
    selectedRegions.map(r => assembleLocString(r)).join(' '),
  )
  const debouncedLocStrings = useDebounce(locStrings, 500)

  // the typed region replaces the rubberband selection outright, so the fetch,
  // the FASTA headers and the size guard all read the same parsed regions.
  // Ref name aliases and lengths have to be loaded first: parsing before that
  // throws, which would read as a bad locstring rather than as not-ready-yet.
  const assemblyReady = !!assembly?.initialized && !!assembly.regions
  let regions: Region[] = []
  let locError: unknown
  if (assemblyReady) {
    try {
      regions = locStringsToRegions(debouncedLocStrings, assembly, assemblyName)
    } catch (e) {
      locError = e
    }
  }

  const settings = useConsensusSettings()
  const {
    showOptions,
    setShowOptions,
    minDepth,
    callFract,
    ambiguityCodes,
    hetFract,
    includeInsertions,
    excludeSecondary,
  } = settings

  // The track's active filterBy flows through, but its default keeps secondary
  // alignments, unlike samtools. The SECONDARY bit is set/cleared rather than
  // left alone, so unchecking includes secondary even when the track itself
  // excluded them.
  const base = display.filterBy ?? defaultFilterFlags
  const filterBy = {
    ...base,
    flagExclude: excludeSecondary
      ? base.flagExclude | SAM_FLAG_SECONDARY
      : base.flagExclude & ~SAM_FLAG_SECONDARY,
  }

  const totalBp = regions.reduce((a, r) => a + (r.end - r.start), 0)
  const tooLargeToFetch = totalBp > MAX_CONSENSUS_BP
  const canFetch = assemblyReady && !locError && !tooLargeToFetch

  // undefined hetFract is what turns ambiguity off in computeConsensus
  const effectiveHetFract = ambiguityCodes ? hetFract : undefined

  // every parameter goes in one nested object rather than as top-level key
  // elements: useFetch reads an undefined/false element of an array key as
  // "not ready, don't fetch", which an undefined hetFract (ambiguity codes off,
  // the default) or an unchecked includeInsertions would trip, leaving the
  // dialog computing forever. Nested, they are just JSON.stringify'd.
  //
  // A consensus can be half a megabase of reads, so the fetch forwards
  // useFetch's stop token: dismissing the dialog, or nudging a slider, stops
  // the worker rather than leaving it grinding on a superseded answer.
  const { data, error, status } = useFetch(
    canFetch
      ? ([
          'getConsensus',
          {
            regions,
            adapterConfig: display.adapterConfig,
            filterBy,
            minDepth,
            callFract,
            hetFract: effectiveHetFract,
            includeInsertions,
          },
        ] as const)
      : false,
    async (
      _name,
      params,
      stopToken,
      statusCallback,
    ): Promise<ConsensusData> => {
      const sessionId = getRpcSessionId(display)
      // one status slot per region, so N concurrent consensus calls aggregate
      // into one bar instead of the last writer winning
      const slot = createStatusFanOut(statusCallback)
      const results = await Promise.all(
        params.regions.map(async region => {
          const { consensus, variants } = await session.rpcManager.call(
            sessionId,
            'GetConsensusSequence',
            {
              adapterConfig: params.adapterConfig,
              regions: [region],
              filterBy: params.filterBy,
              minDepth: params.minDepth,
              callFract: params.callFract,
              hetFract: params.hetFract,
              includeInsertions: params.includeInsertions,
              stopToken,
              statusCallback: slot(),
            },
          )
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

  const loading = canFetch && !data && !error
  const sequence = data ? formatSeqFasta(data.records) : ''
  const vcf = data ? variantsToVcf(data.vcfEntries) : ''
  const variantCount = data
    ? data.vcfEntries.reduce((a, e) => a + e.variants.length, 0)
    : 0
  const sequenceTooLarge = sequence.length > MAX_DISPLAY_BP
  const noSequence = !canFetch || loading || !!error
  const noVariants = noSequence || !variantCount

  return (
    <InfoDialog
      maxWidth="xl"
      open
      title={`Consensus sequence — ${trackName}`}
      onClose={() => {
        handleClose()
      }}
      actions={
        <>
          <CopyToClipboardButton
            value={sequence}
            copiedLabel="Copied"
            disabled={noSequence || sequenceTooLarge}
            color="primary"
            startIcon={<ContentCopyIcon />}
          >
            Copy to clipboard
          </CopyToClipboardButton>
          <Button
            variant="contained"
            onClick={() => {
              download(
                sequence,
                'jbrowse_consensus.fa',
                'text/x-fasta;charset=utf-8',
              )
            }}
            disabled={noSequence}
            color="primary"
            startIcon={<GetAppIcon />}
          >
            Download FASTA
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              download(vcf, 'jbrowse_consensus.vcf', 'text/plain;charset=utf-8')
            }}
            disabled={noVariants}
            color="primary"
            startIcon={<GetAppIcon />}
          >
            Download VCF ({variantCount})
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!isSessionWithAddSessionTrack(session)) {
                session.notify('This session cannot add tracks', 'warning')
                return
              }
              // the VCF covers every region, so a multi-region track is named
              // for the count rather than for whichever one happened to be first
              const region = regions[0]!
              addAndShowTrack(
                session,
                {
                  type: 'VariantTrack',
                  trackId: `consensus-variants-${Date.now()}`,
                  name:
                    regions.length === 1
                      ? `Consensus variants ${region.refName}:${region.start + 1}-${region.end}`
                      : `Consensus variants (${regions.length} regions)`,
                  assemblyNames: [assemblyName],
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
            disabled={noVariants}
            color="primary"
            startIcon={<AddIcon />}
          >
            Open as variant track
          </Button>
        </>
      }
    >
      <div style={{ width: '80em' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 4 }}
        >
          <Typography variant="body2">Region</Typography>
          <TextField
            style={{ width: 320 }}
            size="small"
            variant="standard"
            value={locStrings}
            error={!!locError}
            helperText={locError ? `${locError}` : undefined}
            onChange={event => {
              setLocStrings(event.target.value)
            }}
          />
        </div>
        {tooLargeToFetch ? (
          <ErrorBanner
            error={
              new Error(
                `Region (${toLocale(totalBp)}bp) is too large for a consensus; use up to ${toLocale(MAX_CONSENSUS_BP)}bp.`,
              )
            }
          />
        ) : error ? (
          <ErrorBanner error={error} />
        ) : loading ? (
          <LoadingEllipses
            message={statusProgressLabel(status) || 'Computing consensus'}
          />
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
        <LabeledCheckbox
          size="small"
          checked={showOptions}
          onChange={val => {
            setShowOptions(val)
          }}
          label={<Typography variant="body2">Show options</Typography>}
        />
        {showOptions ? <ConsensusSettingsPanel settings={settings} /> : null}
        <Typography variant="caption" color="text.secondary" component="div">
          Reads vote for a base at each position, matching samtools consensus.
          Variants are the positions differing from the reference, without
          genotypes or quality scores.{' '}
          <ExternalLink href="https://jbrowse.org/jb2/docs/user_guides/consensus_sequence/">
            Details
          </ExternalLink>
        </Typography>
      </div>
    </InfoDialog>
  )
})

export default ConsensusSequenceDialog
