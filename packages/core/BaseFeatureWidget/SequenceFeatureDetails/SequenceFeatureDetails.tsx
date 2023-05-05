import React, { lazy, useRef, useState, Suspense } from 'react'
import {
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
  Tooltip,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import copy from 'copy-to-clipboard'

// locals
import { useLocalStorage } from '../../util'
import { BaseProps } from './../types'
import { ParentFeat } from '../util'
import { LoadingEllipses } from '../../ui'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import { useFeatureSequence } from './hooks'

// lazies
const SettingsDlg = lazy(() => import('./SequenceFeatureSettingsDialog'))
const SequencePanel = lazy(() => import('./SequencePanel'))

const useStyles = makeStyles()(theme => ({
  button: {
    margin: theme.spacing(1),
  },
  formControl: {
    margin: 0,
  },
  container2: {
    marginTop: theme.spacing(1),
  },
}))

// set the key on this component to feature.id to clear state after new feature
// is selected
export default function SequenceFeatureDetails({
  model,
  feature: prefeature,
}: BaseProps) {
  const { classes } = useStyles()
  const feature = prefeature as unknown as ParentFeat
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [intronBp, setIntronBp] = useLocalStorage('intronBp', 10)
  const [upDownBp, setUpDownBp] = useLocalStorage('upDownBp', 500)
  const [copied, setCopied] = useState(false)
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [force, setForce] = useState(false)
  const hasCDS = feature.subfeatures?.some(sub => sub.type === 'CDS')
  const hasExon = feature.subfeatures?.some(sub => sub.type === 'exon')
  const hasExonOrCDS = hasExon || hasCDS
  const { sequence, error } = useFeatureSequence(
    model,
    prefeature,
    upDownBp,
    force,
  )

  const [mode, setMode] = useState(
    hasCDS ? 'cds' : hasExon ? 'cdna' : 'genomic',
  )

  const rest = {
    ...(hasCDS ? { cds: 'CDS' } : {}),
    ...(hasCDS ? { protein: 'Protein' } : {}),
    ...(hasExonOrCDS ? { cdna: 'cDNA' } : {}),
    ...(hasExonOrCDS ? { gene: `Genomic w/ full introns` } : {}),
    ...(hasExonOrCDS
      ? {
          gene_updownstream: `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
        }
      : {}),
    ...(hasExonOrCDS
      ? { gene_collapsed_intron: `Genomic w/ ${intronBp}bp intron` }
      : {}),
    ...(hasExonOrCDS
      ? {
          gene_updownstream_collapsed_intron: `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream `,
        }
      : {}),

    ...(!hasExonOrCDS ? { genomic: 'Genomic' } : {}),
    ...(!hasExonOrCDS
      ? {
          genomic_sequence_updownstream: `Genomic +/- ${upDownBp}bp up+down stream`,
        }
      : {}),
  }

  return (
    <div className={classes.container2}>
      <FormControl className={classes.formControl}>
        <Select value={mode} onChange={event => setMode(event.target.value)}>
          {Object.entries(rest).map(([key, val]) => (
            <MenuItem key={key} value={key}>
              {val}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl className={classes.formControl}>
        <Button
          className={classes.button}
          variant="contained"
          onClick={() => {
            const ref = seqPanelRef.current
            if (ref) {
              copy(ref.textContent || '', { format: 'text/plain' })
              setCopied(true)
              setTimeout(() => setCopied(false), 1000)
            }
          }}
        >
          {copied ? 'Copied to clipboard!' : 'Copy plaintext'}
        </Button>
      </FormControl>
      <FormControl className={classes.formControl}>
        <Tooltip title="The 'Copy HTML' function retains the colors from the sequence panel but cannot be pasted into some programs like notepad that only expect plain text">
          <Button
            className={classes.button}
            variant="contained"
            onClick={() => {
              const ref = seqPanelRef.current
              if (!ref) {
                return
              }
              copy(ref.innerHTML, { format: 'text/html' })
              setCopiedHtml(true)
              setTimeout(() => setCopiedHtml(false), 1000)
            }}
          >
            {copiedHtml ? 'Copied to clipboard!' : 'Copy HTML'}
          </Button>
        </Tooltip>
      </FormControl>
      <Settings
        upDownBp={upDownBp}
        intronBp={intronBp}
        setIntronBp={setIntronBp}
        setUpDownBp={setUpDownBp}
      />
      <br />
      {feature.type === 'gene' ? (
        <Typography>
          Note: inspect subfeature sequences for protein/CDS computations
        </Typography>
      ) : null}
      {error ? (
        <Typography color="error">{`${error}`}</Typography>
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
              intronBp={intronBp}
            />
          </Suspense>
        )
      ) : (
        <Typography>No sequence found</Typography>
      )}
    </div>
  )
}

function Settings({
  intronBp,
  upDownBp,
  setIntronBp,
  setUpDownBp,
}: {
  intronBp: number
  upDownBp: number
  setIntronBp: (arg: number) => void
  setUpDownBp: (arg: number) => void
}) {
  const { classes } = useStyles()
  const [settingsDlgOpen, setSettingsDlgOpen] = useState(false)
  return (
    <>
      <FormControl className={classes.formControl}>
        <IconButton onClick={() => setSettingsDlgOpen(true)}>
          <SettingsIcon />
        </IconButton>
      </FormControl>
      {settingsDlgOpen ? (
        <Suspense fallback={<div />}>
          <SettingsDlg
            handleClose={arg => {
              if (arg) {
                const { upDownBp, intronBp } = arg
                setIntronBp(intronBp)
                setUpDownBp(upDownBp)
              }
              setSettingsDlgOpen(false)
            }}
            upDownBp={upDownBp}
            intronBp={intronBp}
          />
        </Suspense>
      ) : null}
    </>
  )
}
