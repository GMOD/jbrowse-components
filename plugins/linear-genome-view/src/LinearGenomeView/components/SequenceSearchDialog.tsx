import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  dialogContent: {
    width: '40em',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
})

// PAM 3' of the protospacer for Cas9-type enzymes, 5' for Cas12a; cutOffset is
// the bp from the PAM-proximal end of the protospacer to the predicted cut.
const ENZYME_PRESETS: Record<
  string,
  { pam: string; guideLength: number; pamLocation: string; cutOffset: number }
> = {
  SpCas9: { pam: 'NGG', guideLength: 20, pamLocation: '3prime', cutOffset: 3 },
  SaCas9: {
    pam: 'NNGRRT',
    guideLength: 21,
    pamLocation: '3prime',
    cutOffset: 3,
  },
  'Cas12a (Cpf1)': {
    pam: 'TTTV',
    guideLength: 23,
    pamLocation: '5prime',
    cutOffset: 18,
  },
}

const SequenceSearchDialog = observer(function SequenceSearchDialog({
  model,
  handleClose,
}: {
  model: {
    assemblyNames: string[]
    showTrack: (trackId: string) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [mode, setMode] = useState<'pattern' | 'crispr'>('pattern')

  const [value, setValue] = useState('')
  const [caseInsensitive, setCaseInsensitive] = useState(true)

  const [enzyme, setEnzyme] = useState('SpCas9')
  const [pam, setPam] = useState(ENZYME_PRESETS.SpCas9!.pam)
  const [pamLocation, setPamLocation] = useState(
    ENZYME_PRESETS.SpCas9!.pamLocation,
  )
  const [guideLengthStr, setGuideLengthStr] = useState(
    String(ENZYME_PRESETS.SpCas9!.guideLength),
  )
  const [cutOffsetStr, setCutOffsetStr] = useState(
    String(ENZYME_PRESETS.SpCas9!.cutOffset),
  )

  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)

  let patternError: unknown
  try {
    new RegExp(value)
  } catch (e) {
    patternError = e
  }

  const guideLength = Number(guideLengthStr)
  const cutOffset = Number(cutOffsetStr)
  const bothStrandsOff = !searchForward && !searchReverse
  const crisprValid =
    !!pam &&
    Number.isFinite(guideLength) &&
    guideLength > 0 &&
    Number.isFinite(cutOffset)
  const canSubmit =
    !bothStrandsOff &&
    (mode === 'pattern' ? !!value && !patternError : crisprValid)

  function applyPreset(name: string) {
    setEnzyme(name)
    const preset = ENZYME_PRESETS[name]
    if (preset) {
      setPam(preset.pam)
      setPamLocation(preset.pamLocation)
      setGuideLengthStr(String(preset.guideLength))
      setCutOffsetStr(String(preset.cutOffset))
    }
  }

  function handleSubmit() {
    const session = getSession(model)
    const { assemblyManager } = session
    const assemblyName = model.assemblyNames[0]!
    if (isSessionWithAddTracks(session)) {
      const sequenceAdapter = getSnapshot(
        assemblyManager.get(assemblyName)?.configuration.sequence.adapter,
      )
      const shared = {
        trackId:
          mode === 'pattern'
            ? `sequence_search_${Date.now()}`
            : `crispr_guides_${Date.now()}`,
        assemblyNames: [assemblyName],
        type: 'FeatureTrack' as const,
      }
      session.addTrackConf(
        mode === 'pattern'
          ? {
              ...shared,
              name: `Sequence search ${value}`,
              adapter: {
                type: 'SequenceSearchAdapter',
                search: value,
                searchForward,
                searchReverse,
                caseInsensitive,
                sequenceAdapter,
              },
            }
          : {
              ...shared,
              name: `CRISPR guides ${pam}`,
              adapter: {
                type: 'CrisprGuideAdapter',
                pam,
                guideLength,
                pamLocation,
                cutOffset,
                searchForward,
                searchReverse,
                sequenceAdapter,
              },
            },
      )
      model.showTrack(shared.trackId)
    }
    handleClose()
  }

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Sequence search">
      <DialogContent className={classes.dialogContent}>
        <TextField
          select
          label="Search for"
          value={mode}
          onChange={event => {
            setMode(event.target.value === 'crispr' ? 'crispr' : 'pattern')
          }}
        >
          <MenuItem value="pattern">Sequence pattern</MenuItem>
          <MenuItem value="crispr">CRISPR guide RNAs</MenuItem>
        </TextField>

        {mode === 'pattern' ? (
          <>
            <Typography>
              Supply a sequence to search for. A track will be created with the
              resulting matches once submitted. You can also supply regex style
              expressions e.g. AACT(C|T).
            </Typography>
            <TextField
              value={value}
              onChange={e => {
                setValue(e.target.value)
              }}
              label="Sequence search pattern"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={caseInsensitive}
                  onChange={event => {
                    setCaseInsensitive(event.target.checked)
                  }}
                />
              }
              label="Case insensitive"
            />
            {patternError ? (
              <Typography color="error">{`${patternError}`}</Typography>
            ) : null}
          </>
        ) : (
          <>
            <Typography>
              Scan the reference for CRISPR guide RNAs. A track is created
              showing each protospacer, its PAM, and the predicted cut site.
              Pick an enzyme preset or set a custom PAM.
            </Typography>
            <TextField
              select
              label="Enzyme"
              value={enzyme}
              onChange={event => {
                applyPreset(event.target.value)
              }}
            >
              {[...Object.keys(ENZYME_PRESETS), 'Custom'].map(name => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="PAM (IUPAC)"
              value={pam}
              onChange={event => {
                setEnzyme('Custom')
                setPam(event.target.value.toUpperCase())
              }}
              helperText="e.g. NGG for SpCas9, TTTV for Cas12a"
            />
            <TextField
              select
              label="PAM location"
              value={pamLocation}
              onChange={event => {
                setEnzyme('Custom')
                setPamLocation(event.target.value)
              }}
            >
              <MenuItem value="3prime">3′ of protospacer (Cas9)</MenuItem>
              <MenuItem value="5prime">5′ of protospacer (Cas12a)</MenuItem>
            </TextField>
            <TextField
              label="Guide length (bp)"
              value={guideLengthStr}
              error={!(Number.isFinite(guideLength) && guideLength > 0)}
              onChange={event => {
                setEnzyme('Custom')
                setGuideLengthStr(event.target.value)
              }}
            />
            <TextField
              label="Cut offset from PAM (bp)"
              value={cutOffsetStr}
              error={!Number.isFinite(cutOffset)}
              onChange={event => {
                setEnzyme('Custom')
                setCutOffsetStr(event.target.value)
              }}
            />
          </>
        )}

        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={searchForward}
                onChange={event => {
                  setSearchForward(event.target.checked)
                }}
              />
            }
            label="Search forward strand"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={searchReverse}
                onChange={event => {
                  setSearchReverse(event.target.checked)
                }}
              />
            }
            label="Search reverse strand"
          />
        </FormGroup>
        {bothStrandsOff ? (
          <Typography color="error">Select at least one strand</Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleSubmit()
          }}
          disabled={!canSubmit}
          variant="contained"
          color="primary"
        >
          Submit
        </Button>

        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="secondary"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SequenceSearchDialog
