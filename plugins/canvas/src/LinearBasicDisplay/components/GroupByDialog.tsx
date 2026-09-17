import { useState } from 'react'

import { LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { FEATURE_GROUP_BY_DIMENSIONS, isGroupColor } from '../groupBy.ts'

import type { FeatureGroupBy, FeatureGroupByType } from '../groupBy.ts'
import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'

const CHOICES = ['none', 'strand', 'attribute'] as const satisfies readonly (
  | FeatureGroupByType
  | 'none'
)[]

type Choice = (typeof CHOICES)[number]

function groupByOf(choice: Choice, attribute: string) {
  return choice === 'strand'
    ? ({ type: 'strand' } as const)
    : choice === 'attribute' && attribute
      ? ({ type: 'attribute', attribute } as const)
      : undefined
}

const GroupByDialog = observer(function GroupByDialog({
  model,
  handleClose,
  color,
  colorField,
}: {
  model: {
    groupBy: FeatureGroupBy | undefined
    applyGroupBy: (groupBy: FeatureGroupBy | undefined, color: boolean) => void
    groupByChannelSpec: (
      groupBy: FeatureGroupBy | undefined,
      color: boolean,
    ) => ChannelSpec
    openChannelSpecDialog: (seed?: ChannelSpec) => void
  }
  handleClose: () => void
  color: string | undefined
  colorField: string
}) {
  const [choice, setChoice] = useState<Choice>(model.groupBy?.type ?? 'none')
  const [attribute, setAttribute] = useState(model.groupBy?.attribute ?? '')
  const [colorChoice, setColorChoice] = useState<boolean>()
  const groupBy = groupByOf(choice, attribute.trim())
  const alsoColor =
    colorChoice ??
    ((color === undefined && colorField === '') ||
      isGroupColor(colorField, groupBy ?? model.groupBy))

  return (
    <SubmitDialog
      open
      title="Group by"
      submitText="Apply"
      submitDisabled={choice !== 'none' && !groupBy}
      onCancel={handleClose}
      onSubmit={() => {
        model.applyGroupBy(groupBy, alsoColor)
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openChannelSpecDialog(
              model.groupByChannelSpec(groupBy, alsoColor),
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
        {(['strand', 'attribute'] as const).map(type => (
          <FormControlLabel
            key={type}
            value={type}
            control={<Radio />}
            label={FEATURE_GROUP_BY_DIMENSIONS[type].label}
          />
        ))}
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
