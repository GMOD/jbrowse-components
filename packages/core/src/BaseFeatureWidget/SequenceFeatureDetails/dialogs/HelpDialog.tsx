import MoreVert from '@mui/icons-material/MoreVert'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { InfoDialog } from '../../../ui/index.ts'
import { sequenceModeNames, sequenceModes } from '../sequenceModes.ts'

import type { SequenceFeatureDetailsModel } from '../model.ts'
import type { SequenceDisplayMode } from '../sequenceModes.ts'

const ModeList = observer(function ModeList({
  modes,
  model,
}: {
  modes: SequenceDisplayMode[]
  model: SequenceFeatureDetailsModel
}) {
  const { intronBp, upDownBp } = model
  return (
    <ul>
      {modes.map(mode => (
        <li key={mode}>
          {sequenceModes[mode].label({ intronBp, upDownBp })}:{' '}
          {sequenceModes[mode].description}
        </li>
      ))}
    </ul>
  )
})

const HelpDialog = observer(function HelpDialog({
  model,
  handleClose,
}: {
  model: SequenceFeatureDetailsModel
  handleClose: () => void
}) {
  const isGenomic = (mode: SequenceDisplayMode) =>
    sequenceModes[mode].seqtype === 'genomic'
  return (
    <InfoDialog
      maxWidth="xl"
      open
      onClose={() => {
        handleClose()
      }}
      title="Feature sequence panel help"
    >
      <Typography>
        The feature sequence panel shows the reference sequence under a feature.
        For a gene it reads one transcript, picked from the Transcript menu when
        there are several. The sequence types for a transcript are:
      </Typography>
      <ModeList
        model={model}
        modes={sequenceModeNames.filter(mode => !isGenomic(mode))}
      />
      <Typography>For other features they are:</Typography>
      <ModeList model={model} modes={sequenceModeNames.filter(isGenomic)} />
      <Typography>
        The <MoreVert fontSize="small" /> menu copies or downloads the sequence
        as FASTA or HTML, reverse-complements the genomic types, shows
        coordinates, and opens Settings, where you set the intron and
        up/downstream bases, the bases per row and the capitalization.
      </Typography>
      <Typography>
        Copy HTML keeps the colors, so it pastes into a word processor but not
        into a plain-text editor; use Copy FASTA there.
      </Typography>
    </InfoDialog>
  )
})

export default HelpDialog
