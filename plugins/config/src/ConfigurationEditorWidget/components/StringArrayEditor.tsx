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

const StringArrayEditor = observer(function StringArrayEditor({
  slot,
}: {
  slot: {
    name: string
    value: string[]
    set: (arg: string[]) => void
    description: string
  }
}) {
  const value = [...slot.value]
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
              value={val}
              onChange={evt => {
                slot.set(
                  value.map((v, i) => (i === idx ? evt.target.value : v)),
                )
              }}
              slotProps={{
                input: {
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
            onAdd={val => {
              slot.set([...value, val])
            }}
          />
        </ListItem>
      </List>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default StringArrayEditor
