import { useState } from 'react'

import {
  ErrorBanner,
  LabeledCheckbox,
  LoadingEllipses,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { statusProgressLabel } from '@jbrowse/core/util'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { useFetch } from '@jbrowse/core/util/useFetch'
import {
  Autocomplete,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  attributeGroupingVerdict,
  sectionCountHint,
} from './attributeGroupingVerdict.ts'

import type { GroupByScanOptions } from '../scanGroupByCandidates.ts'
import type { GroupByScan } from './attributeGroupingVerdict.ts'
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

export interface GroupByDialogModel {
  id: string
  facet: { field: string } | undefined
  applyGroupBy: (field: string | undefined, color: boolean) => void
  groupByChannelSpec: (field: string | undefined, color: boolean) => ChannelSpec
  openChannelSpecDialog: (seed?: ChannelSpec) => void
  scanGroupByCandidates: (opts: GroupByScanOptions) => Promise<GroupByScan>
}

const GroupByDialog = observer(function GroupByDialog({
  model,
  handleClose,
  color,
  colorField,
}: {
  model: GroupByDialogModel
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

  // The render fetch's download again, so it runs only once the attribute
  // choice asks for it. Keyed by the display's id: an MST node stringifies to
  // its whole snapshot.
  const {
    data: scan,
    error,
    isLoading,
    status,
  } = useFetch(
    choice === 'attribute'
      ? (['canvasGroupByCandidates', model.id] as const)
      : null,
    (_name, _id, signal, statusCallback) =>
      model.scanGroupByCandidates({ signal, statusCallback }),
  )
  const candidates = scan === undefined || !Array.isArray(scan) ? [] : scan
  const verdict = attributeGroupingVerdict(attribute.trim(), scan)

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
        <>
          <Autocomplete
            freeSolo
            options={candidates.map(c => c.field)}
            inputValue={attribute}
            onInputChange={(_event, value) => {
              setAttribute(value)
            }}
            loading={isLoading}
            renderOption={({ key, ...props }, option) => {
              const candidate = candidates.find(c => c.field === option)
              return (
                <li key={key} {...props}>
                  <span style={{ flex: 1 }}>{option}</span>
                  {candidate ? (
                    <Typography variant="caption" color="text.secondary">
                      {sectionCountHint(candidate)}
                    </Typography>
                  ) : null}
                </li>
              )
            }}
            renderInput={({ slotProps, ...params }) => (
              <TextField
                {...params}
                label="Attribute name"
                placeholder="e.g. biotype"
                autoFocus
                fullWidth
                slotProps={{
                  ...slotProps,
                  htmlInput: {
                    ...slotProps.htmlInput,
                    'data-testid': 'group-by-attribute',
                  },
                }}
              />
            )}
          />
          {isLoading ? (
            <LoadingEllipses
              message={
                statusProgressLabel(status) ||
                'Scanning features for attributes'
              }
            />
          ) : error ? (
            <ErrorBanner error={error} />
          ) : verdict ? (
            <Typography variant="caption" color={verdict.color}>
              {verdict.text}
            </Typography>
          ) : null}
        </>
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
