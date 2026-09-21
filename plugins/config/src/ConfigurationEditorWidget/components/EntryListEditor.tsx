import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  FormHelperText,
  IconButton,
  InputLabel,
  List,
  ListItem,
  MenuItem,
} from '@mui/material'
import { observer } from 'mobx-react'

import ColorEditor from './ColorEditor.tsx'
import ConfigurationTextField from './ConfigurationTextField.tsx'

import type { ReactNode } from 'react'

interface ListSlot {
  name: string
  value: string[]
  description: string
  set: (arg: string[]) => void
}

// A list slot whose entries each take one control: the list is written whole
// on every change, and "add" appends an entry the slot already admits, so no
// write can hold an entry the slot refuses.
const EntryList = observer(function EntryList({
  slot,
  entry,
  added,
}: {
  slot: ListSlot
  entry: (value: string, set: (value: string) => void) => ReactNode
  added: (value: string[]) => string | undefined
}) {
  const value = [...slot.value]
  const addition = added(value)
  return (
    <>
      {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
      <List disablePadding>
        {value.map((v, idx) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- entries repeat, and the list is never reordered
          <ListItem key={idx} disableGutters>
            {entry(v, next => {
              slot.set(value.map((old, i) => (i === idx ? next : old)))
            })}
            <IconButton
              aria-label="delete entry"
              onClick={() => {
                slot.set(value.filter((_, i) => i !== idx))
              }}
            >
              <DeleteIcon />
            </IconButton>
          </ListItem>
        ))}
        <ListItem disableGutters>
          <IconButton
            data-testid={`entryAdd-${slot.name}`}
            aria-label="add entry"
            disabled={addition === undefined}
            onClick={() => {
              if (addition !== undefined) {
                slot.set([...value, addition])
              }
            }}
          >
            <AddIcon />
          </IconButton>
        </ListItem>
      </List>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

/** #slotEditor a text field and color picker per entry, with add and delete */
const ColorArrayEditor = observer(function ColorArrayEditor({
  slot,
}: {
  slot: ListSlot
}) {
  return (
    <EntryList
      slot={slot}
      added={value => value.at(-1) ?? 'black'}
      entry={(color, set) => (
        <ColorEditor
          slot={{ name: '', description: '', value: color, set }}
          admitsJexl={false}
        />
      )}
    />
  )
})

/** #slotEditor a dropdown of the `model`'s members per entry, with add and delete */
const StringEnumArrayEditor = observer(function StringEnumArrayEditor({
  slot,
}: {
  slot: ListSlot & { choices?: string[] }
}) {
  const choices = slot.choices ?? []
  return (
    <EntryList
      slot={slot}
      added={() => choices[0]}
      entry={(member, set) => (
        <ConfigurationTextField
          select
          value={member}
          onChange={evt => {
            set(evt.target.value)
          }}
        >
          {choices.map(choice => (
            <MenuItem key={choice} value={choice}>
              {choice}
            </MenuItem>
          ))}
        </ConfigurationTextField>
      )}
    />
  )
})

export { ColorArrayEditor, StringEnumArrayEditor }
