import { useState } from 'react'

import { LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import { STRAND_FIELD } from '@jbrowse/core/util/strandScale'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'

const CHOICES = ['none', 'strand', 'attribute'] as const

type Choice = (typeof CHOICES)[number]

function choiceOf(field: string | undefined): Choice {
  return !field ? 'none' : field === STRAND_FIELD ? 'strand' : 'attribute'
}

function fieldOf(choice: Choice, attribute: string) {
  return choice === 'strand'
    ? STRAND_FIELD
    : choice === 'attribute' && attribute
      ? attribute
      : undefined
}

const GroupByDialog = observer(function GroupByDialog({
  model,
  handleClose,
  color,
  colorField,
}: {
  model: {
    facet: { field: string } | undefined
    applyGroupBy: (field: string | undefined, color: boolean) => void
    groupByChannelSpec: (
      field: string | undefined,
      color: boolean,
    ) => ChannelSpec
    openChannelSpecDialog: (seed?: ChannelSpec) => void
  }
  handleClose: () => void
  color: string | undefined
  colorField: string
}) {
  const current = model.facet?.field
  const [choice, setChoice] = useState(choiceOf(current))
  const [attribute, setAttribute] = useState(
    current === STRAND_FIELD ? '' : (current ?? ''),
  )
  const [colorChoice, setColorChoice] = useState<boolean>()
  const field = fieldOf(choice, attribute.trim())
  const alsoColor =
    colorChoice ??
    ((color === undefined && colorField === '') ||
      (colorField !== '' && colorField === (field ?? current)))

  return (
    <SubmitDialog
      open
      title="Group by"
      submitText="Apply"
      submitDisabled={choice !== 'none' && !field}
      onCancel={handleClose}
      onSubmit={() => {
        model.applyGroupBy(field, alsoColor)
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openChannelSpecDialog(
              model.groupByChannelSpec(field, alsoColor),
            )
            handleClose()
          }}
        >
          Edit as JSON...
        </Button>
      }
    >
      <Typography color="text.secondary" gutterBottom>
        Packs the features into labelled sections, one per group, stacked in
        this track.
      </Typography>
      <RadioGroup
        value={choice}
        onChange={event => {
          setChoice(CHOICES.find(c => c === event.target.value) ?? 'none')
        }}
      >
        <FormControlLabel value="none" control={<Radio />} label="None" />
        <FormControlLabel value="strand" control={<Radio />} label="Strand" />
        <FormControlLabel
          value="attribute"
          control={<Radio />}
          label="Attribute"
        />
      </RadioGroup>
      {choice === 'attribute' ? (
        <TextField
          label="Attribute name"
          value={attribute}
          onChange={event => {
            setAttribute(event.target.value)
          }}
          placeholder="e.g. biotype"
          helperText="Common attributes: type, source, biotype, gene_biotype"
          autoFocus
          fullWidth
          slotProps={{ htmlInput: { 'data-testid': 'group-by-attribute' } }}
        />
      ) : null}
      {choice === 'none' ? null : (
        <div>
          <LabeledCheckbox
            checked={alsoColor}
            onChange={setColorChoice}
            label={
              choice === 'strand'
                ? 'Also color by strand'
                : 'Also color by this attribute'
            }
          />
        </div>
      )}
    </SubmitDialog>
  )
})

export default GroupByDialog
