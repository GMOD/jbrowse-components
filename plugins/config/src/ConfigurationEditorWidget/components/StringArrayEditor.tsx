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
    setAtIndex: (arg: number, arg2: string) => void
    removeAtIndex: (arg: number) => void
    add: (arg: string) => void
    description: string
  }
}) {
  return (
    <>
      {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
      <List disablePadding>
        {/* index keys are safe here: inputs are fully controlled from
            slot.value with no per-row state, and the list is never reordered.
            keying by content would remount on every keystroke and drop focus */}
        {slot.value.map((val, idx) => (
          <ListItem key={idx} disableGutters>
            <TextField
              fullWidth
              value={val}
              onChange={evt => {
                slot.setAtIndex(idx, evt.target.value)
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => {
                          slot.removeAtIndex(idx)
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
              slot.add(val)
            }}
          />
        </ListItem>
      </List>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default StringArrayEditor
