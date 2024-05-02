import React, { lazy, useRef, useState, Suspense } from 'react'
import {
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
  ButtonGroup,
  Tooltip,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver'
import { formatSeqFasta } from '@jbrowse/core/util/formatFastaStrings'

// locals
import { useFeatureSequence } from './hooks'
import { ErrorMessage, LoadingEllipses, Menu } from '../../ui'
import { SimpleFeatureSerialized, getSession } from '../../util'
import { SeqState } from '../util'
import { BaseFeatureWidgetModel } from '../stateModelFactory'

// icons
import Settings from '@mui/icons-material/Settings'
import CopyAllIcon from '@mui/icons-material/CopyAll'
import HtmlIcon from '@mui/icons-material/Html'
import DownloadIcon from '@mui/icons-material/Download'

// lazies
const SequencePanel = lazy(() => import('./SequencePanel'))
const SettingsDialog = lazy(() => import('./dialogs/SettingsDialog'))

const useStyles = makeStyles()({
  seqPanelOptions: {
    display: 'flex',
    alignContent: 'center',
    gap: 5,
  },
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

// set the key on this component to feature.id to clear state after new feature
// is selected
const SequenceFeatureDetails = observer(function ({
  model,
  feature,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { sequenceFeatureDetails } = model
  const { intronBp, upDownBp } = sequenceFeatureDetails
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [force, setForce] = useState(false)
  const hasCDS = feature.subfeatures?.some(sub => sub.type === 'CDS')
  const hasExon = feature.subfeatures?.some(sub => sub.type === 'exon')
  const hasExonOrCDS = hasExon || hasCDS

  const [mode, setMode] = useState(
    hasCDS ? 'cds' : hasExon ? 'cdna' : 'genomic',
  )

  const { sequence, error } = useFeatureSequence(
    model,
    mode,
    feature,
    upDownBp,
    force,
  )

  const options = [
    {
      icon: CopyAllIcon,
      label: 'Copy plaintext',
      onClick: () => {
        const ref = seqPanelRef.current
        if (ref) {
          copy(ref.textContent || '', { format: 'text/plain' })
          getSession(model).notify('Copied plaintext to clipboard!', 'info')
        }
      },
    },
    {
      icon: HtmlIcon,
      label: 'Copy HTML',
      onClick: () => {
        const ref = seqPanelRef.current
        if (!ref) {
          return
        }
        copy(ref.innerHTML, { format: 'text/html' })
        getSession(model).notify('Copied HTML to clipboard!', 'info')
      },
    },
    {
      icon: DownloadIcon,
      label: 'Download FASTA',
      onClick: () => {
        const ref = seqPanelRef.current
        if (ref?.textContent && sequence && !('error' in sequence)) {
          const dispSeq = {
            seq: ref?.textContent?.slice(sequence.header.length + 1),
            header: sequence.header,
          } as SeqState

          saveAs(
            new Blob([formatSeqFasta([{ ...dispSeq }]) || ''], {
              type: 'text/x-fasta;charset=utf-8',
            }),
            'jbrowse_ref_seq.fa',
          )
        }
      },
    },
  ]

  return (
    <>
      <div className={classes.seqPanelOptions}>
        <FormControl className={classes.formControl}>
          <Select
            size="small"
            value={mode}
            onChange={event => setMode(event.target.value)}
          >
            {Object.entries({
              ...(hasCDS
                ? {
                    cds: 'CDS',
                  }
                : {}),
              ...(hasCDS
                ? {
                    protein: 'Protein',
                  }
                : {}),
              ...(hasExonOrCDS
                ? {
                    cdna: 'cDNA',
                  }
                : {}),
              ...(hasExonOrCDS
                ? {
                    gene: `Genomic w/ full introns`,
                  }
                : {}),
              ...(hasExonOrCDS
                ? {
                    gene_updownstream: `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
                  }
                : {}),
              ...(hasExonOrCDS
                ? {
                    gene_collapsed_intron: `Genomic w/ ${intronBp}bp intron`,
                  }
                : {}),
              ...(hasExonOrCDS
                ? {
                    gene_updownstream_collapsed_intron: `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream `,
                  }
                : {}),

              ...(!hasExonOrCDS
                ? {
                    genomic: 'Genomic',
                  }
                : {}),
              ...(!hasExonOrCDS
                ? {
                    genomic_sequence_updownstream: `Genomic +/- ${upDownBp}bp up+down stream`,
                  }
                : {}),
            }).map(([key, val]) => (
              <MenuItem key={key} value={key}>
                {val}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ButtonGroup variant="contained">
          {options.map(option => {
            return (
              <Tooltip title={option.label} key={JSON.stringify(option)}>
                <Button size="small" onClick={option.onClick}>
                  <option.icon />
                </Button>
              </Tooltip>
            )
          })}
        </ButtonGroup>
        <IconButton
          className={classes.formControl}
          onClick={() =>
            getSession(model).queueDialog(handleClose => [
              SettingsDialog,
              { model: sequenceFeatureDetails, handleClose },
            ])
          }
        >
          <Settings />
        </IconButton>
      </div>
      <div>
        {feature.type === 'gene' ? (
          <Typography>
            Note: inspect subfeature sequences for protein/CDS computations
          </Typography>
        ) : null}
        {error ? (
          <ErrorMessage error={error} />
        ) : !sequence ? (
          <LoadingEllipses />
        ) : sequence ? (
          'error' in sequence ? (
            <>
              <Typography color="error">{sequence.error}</Typography>
              <Button
                variant="contained"
                color="inherit"
                onClick={() => setForce(true)}
              >
                Force load
              </Button>
            </>
          ) : (
            <Suspense fallback={<LoadingEllipses />}>
              <SequencePanel
                ref={seqPanelRef}
                feature={feature}
                mode={mode}
                sequence={sequence}
                model={sequenceFeatureDetails}
              />
            </Suspense>
          )
        ) : (
          <Typography>No sequence found</Typography>
        )}
      </div>
    </>
  )
})

export default SequenceFeatureDetails
