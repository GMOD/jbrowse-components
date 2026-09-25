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
 * the members the control never displayed.
 */
export default function MarkFieldPicker({
  channel,
  edit,
  fields,
  problems,
  onChange,
}: {
  channel: EditChannel
  edit: ChannelEdit
  fields: PlotFields
  problems: readonly MarkProblem[]
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
