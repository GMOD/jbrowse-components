import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import { IUPAC_MOTIF_REGEX } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import SearchPanelForm from './SearchPanelForm.tsx'
import StrandCheckboxes from './StrandCheckboxes.tsx'
import { addReferenceScanTrack } from './searchModes.ts'

import type { SequenceSearchModeProps } from './searchModes.ts'

const useStyles = makeStyles()({
  row: {
    display: 'flex',
    gap: 12,
    '& > *': {
      flex: 1,
    },
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
})

// PAM 3' of the protospacer for Cas9-type enzymes, 5' for Cas12a. The two cut
// offsets are bp from the PAM-proximal end of the protospacer to each strand's
// cut: equal for a blunt cutter, staggered for Cas12a, which leaves a 5-nt 5'
// overhang.
const ENZYME_PRESETS: Record<
  string,
  {
    pam: string
    guideLength: number
    pamLocation: string
    cutOffset: number
    cutOffsetBottom: number
  }
> = {
  SpCas9: {
    pam: 'NGG',
    guideLength: 20,
    pamLocation: '3prime',
    cutOffset: 3,
    cutOffsetBottom: 3,
  },
  SaCas9: {
    pam: 'NNGRRT',
    guideLength: 21,
    pamLocation: '3prime',
    cutOffset: 3,
    cutOffsetBottom: 3,
  },
  'Cas12a (Cpf1)': {
    pam: 'TTTV',
    guideLength: 23,
    pamLocation: '5prime',
    cutOffset: 18,
    cutOffsetBottom: 23,
  },
}

// The one filter preset the panel offers. The adapter's slots are a free GC
// range plus a poly-T flag; these are the conventional cutoffs, named in the
// checkbox label so the numbers aren't hidden behind a word like "usable".
const GC_FILTER = { minGcPercent: 40, maxGcPercent: 60 }
const NO_FILTER = { minGcPercent: 0, maxGcPercent: 100 }

const DEFAULT_ENZYME = 'SpCas9'
const DEFAULT_PRESET = ENZYME_PRESETS[DEFAULT_ENZYME]!

const toBpCount = (str: string) => (str.trim() ? Number(str) : Number.NaN)

const CrisprGuidePanel = observer(function CrisprGuidePanel({
  model,
  handleClose,
}: SequenceSearchModeProps) {
  const { classes } = useStyles()
  const [enzyme, setEnzyme] = useState(DEFAULT_ENZYME)
  const [pam, setPam] = useState(DEFAULT_PRESET.pam)
  const [pamLocation, setPamLocation] = useState(DEFAULT_PRESET.pamLocation)
  const [guideLengthStr, setGuideLengthStr] = useState(
    String(DEFAULT_PRESET.guideLength),
  )
  const [cutOffsetStr, setCutOffsetStr] = useState(
    String(DEFAULT_PRESET.cutOffset),
  )
  // presets carry this; Custom is treated as a blunt cutter, so the panel does
  // not grow a second offset field for a case config can express directly
  const [cutOffsetBottom, setCutOffsetBottom] = useState(
    DEFAULT_PRESET.cutOffsetBottom,
  )
  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)
  const [filterQuality, setFilterQuality] = useState(false)

  // `Number('')` is 0, so an emptied field would otherwise read as a valid zero
  const guideLength = toBpCount(guideLengthStr)
  const cutOffset = toBpCount(cutOffsetStr)
  // both are bp counts used for fixed-length string slicing, so a fractional
  // value would silently truncate and skew the placement
  const guideLengthValid = Number.isInteger(guideLength) && guideLength > 0
  // a cut beyond either end of the protospacer draws its tick outside the glyph
  // that is supposed to carry it, and outside the box that can be clicked
  const cutOffsetValid =
    Number.isInteger(cutOffset) && cutOffset >= 0 && cutOffset <= guideLength
  // each PAM position must be a single IUPAC code (one base); other characters
  // would leak into the match regex and break the fixed-length placement
  const pamValid = IUPAC_MOTIF_REGEX.test(pam)
  const canSubmit =
    pamValid &&
    guideLengthValid &&
    cutOffsetValid &&
    (searchForward || searchReverse)

  // a staggered cutter shows both offsets, e.g. "cut 18/23 bp from PAM"
  const cutSummary =
    cutOffsetBottom === cutOffset
      ? cutOffset
      : `${cutOffset}/${cutOffsetBottom}`
  const presetSummary = ENZYME_PRESETS[enzyme]
    ? `PAM ${pam} · ${guideLength} bp guide · cut ${cutSummary} bp from PAM`
    : 'Set a custom PAM and geometry below'

  function applyPreset(name: string) {
    setEnzyme(name)
    const preset = ENZYME_PRESETS[name]
    if (preset) {
      setPam(preset.pam)
      setPamLocation(preset.pamLocation)
      setGuideLengthStr(String(preset.guideLength))
      setCutOffsetStr(String(preset.cutOffset))
      setCutOffsetBottom(preset.cutOffsetBottom)
    }
  }

  function handleSubmit() {
    addReferenceScanTrack(model, {
      trackId: `crispr_guides_${Date.now()}`,
      name:
        enzyme === 'Custom'
          ? `CRISPR guides ${pam}`
          : `CRISPR guides ${enzyme} (${pam})`,
      adapter: {
        type: 'CrisprGuideAdapter',
        pam,
        guideLength,
        pamLocation,
        cutOffset,
        cutOffsetBottom: enzyme === 'Custom' ? cutOffset : cutOffsetBottom,
        searchForward,
        searchReverse,
        excludePolyT: filterQuality,
        ...(filterQuality ? GC_FILTER : NO_FILTER),
      },
    })
    handleClose()
  }

  return (
    <SearchPanelForm
      onSubmit={handleSubmit}
      handleClose={handleClose}
      submitDisabled={!canSubmit}
    >
      <TextField
        select
        variant="outlined"
        size="small"
        label="Enzyme"
        value={enzyme}
        helperText={presetSummary}
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
      {enzyme === 'Custom' ? (
        <>
          <TextField
            size="small"
            label="PAM (IUPAC)"
            value={pam}
            error={!pamValid}
            helperText={pamValid ? undefined : 'Use IUPAC codes only'}
            onChange={event => {
              setPam(event.target.value.toUpperCase())
            }}
          />
          <div className={classes.row}>
            <TextField
              size="small"
              label="Guide length (bp)"
              value={guideLengthStr}
              error={!guideLengthValid}
              helperText={guideLengthValid ? undefined : 'A whole number of bp'}
              onChange={event => {
                setGuideLengthStr(event.target.value)
              }}
            />
            <TextField
              size="small"
              label="Cut offset (bp)"
              value={cutOffsetStr}
              error={!cutOffsetValid}
              helperText={
                cutOffsetValid ? undefined : 'bp from the PAM, within the guide'
              }
              onChange={event => {
                setCutOffsetStr(event.target.value)
              }}
            />
          </div>
          <div className={classes.toggleRow}>
            <Typography variant="body2" color="textSecondary">
              PAM location
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={pamLocation}
              onChange={(_event, value) => {
                if (value) {
                  setPamLocation(value)
                }
              }}
            >
              <ToggleButton value="3prime">3′ (Cas9)</ToggleButton>
              <ToggleButton value="5prime">5′ (Cas12a)</ToggleButton>
            </ToggleButtonGroup>
          </div>
        </>
      ) : null}
      <StrandCheckboxes
        searchForward={searchForward}
        searchReverse={searchReverse}
        setSearchForward={setSearchForward}
        setSearchReverse={setSearchReverse}
      />
      <LabeledCheckbox
        size="small"
        checked={filterQuality}
        onChange={val => {
          setFilterQuality(val)
        }}
        label="Keep only guides with 40-60% GC and no poly-T run"
      />
    </SearchPanelForm>
  )
})

export default CrisprGuidePanel
