import { Autocomplete, TextField } from '@mui/material'

import { MarkSlotProblems } from './MarkProblems.tsx'

import type { ChannelEdit, EditChannel } from '../markEdit.ts'
import type { MarkProblem } from '../markProblems.ts'
import type { PlotFields } from '../scanPlotFields.ts'

/**
 * One channel's control: the fields the scan found, and free text besides, so
 * a dotted path (`INFO.DP`, `tags.NM`), a `jexl:` expression or a constant
 * still goes through. A declaration the picker cannot round-trip is shown
 * read-only rather than offered for editing, since writing it back would drop
 * the members the control never displayed. `onEditStart` and `onEditEnd` mark
 * focus entering and leaving the control, since an edit is written against
 * the channel as it stood when it began.
 */
export default function MarkFieldPicker({
  channel,
  edit,
  fields,
  problems,
  onEditStart,
  onEditEnd,
  onChange,
}: {
  channel: EditChannel
  edit: ChannelEdit
  fields: PlotFields
  problems: readonly MarkProblem[]
  onEditStart: () => void
  onEditEnd: () => void
  onChange: (value: string) => void
}) {
  const options = [...fields.numeric, ...fields.categorical].sort((a, b) =>
    a.localeCompare(b),
  )
  return (
    <>
      <Autocomplete
        freeSolo
        disabled={edit.beyond}
        onFocus={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            onEditStart()
          }
        }}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            onEditEnd()
          }
        }}
        options={options}
        inputValue={edit.beyond ? '' : edit.value}
        onInputChange={(_event, next) => {
          onChange(next)
        }}
        renderInput={({ slotProps, ...params }) => (
          <TextField
            {...params}
            label={channel}
            fullWidth
            helperText={
              edit.beyond
                ? 'says more than this control can — edit as JSON'
                : undefined
            }
            slotProps={{
              ...slotProps,
              htmlInput: {
                ...slotProps.htmlInput,
                'data-testid': `channel-${channel}`,
              },
            }}
          />
        )}
      />
      <MarkSlotProblems problems={problems} />
    </>
  )
}
