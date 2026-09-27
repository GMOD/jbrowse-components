import { JEXL_PREFIX } from '@jbrowse/core/util/jexlStrings'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import AddNewField from './AddNewField.tsx'

interface ArraySlot {
  name: string
  value: string[]
  set: (arg: string[]) => void
  description: string
}

/** #slotEditor "todolist" of text fields, one per entry, with add and delete */
const StringArrayEditor = observer(function StringArrayEditor({
  slot,
  prefix = '',
}: {
  slot: ArraySlot
  prefix?: string
}) {
  const value = [...slot.value]
  const startAdornment = prefix ? (
    <InputAdornment position="start">{prefix}</InputAdornment>
  ) : undefined
  return (
    <>
      {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
      <List disablePadding>
        {/* index keys are safe here: inputs are fully controlled from
            slot.value with no per-row state, and the list is never reordered.
            keying by content would remount on every keystroke and drop focus */}
        {value.map((val, idx) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- controlled inputs, list never reordered (see comment above)
          <ListItem key={idx} disableGutters>
            <TextField
              fullWidth
              value={val.slice(prefix.length)}
              onChange={evt => {
                slot.set(
                  value.map((v, i) =>
                    i === idx ? prefix + evt.target.value : v,
                  ),
                )
              }}
              slotProps={{
                input: {
                  startAdornment,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => {
                          slot.set(value.filter((_, i) => i !== idx))
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </ListItem>
        ))}
        <ListItem disableGutters>
          <AddNewField
            testid={`stringArrayAdd-${slot.name}`}
            startAdornment={startAdornment}
            onAdd={val => {
              slot.set([...value, prefix + val])
            }}
          />
        </ListItem>
      </List>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

// `jexl:` sits fixed in front of each entry, so no keystroke writes one the
// slot refuses
/** #slotEditor "todolist" of text fields, each after a fixed `jexl:` */
const ExpressionArrayEditor = observer(function ExpressionArrayEditor({
  slot,
}: {
  slot: ArraySlot
}) {
  return <StringArrayEditor slot={slot} prefix={JEXL_PREFIX} />
})

export { ExpressionArrayEditor }
export default StringArrayEditor
