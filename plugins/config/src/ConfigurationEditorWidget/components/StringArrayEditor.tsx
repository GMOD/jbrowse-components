import React, { useState } from 'react'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

// icons

const StringArrayEditor = observer(function ({
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
  const [value, setValue] = useState('')
  const [addNew, setAddNew] = useState(false)
  return (
    <>
      {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
      <List disablePadding>
        {slot.value.map((val, idx) => (
          <ListItem key={`${JSON.stringify(val)}-${idx}`} disableGutters>
            <TextField
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

        {addNew ? (
          <ListItem disableGutters>
            <TextField
              value={value}
              placeholder="add new"
              onChange={event => {
                setValue(event.target.value)
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <>
                        <Button
                          color="primary"
                          variant="contained"
                          style={{ margin: 2 }}
                          data-testid={`stringArrayAdd-${slot.name}`}
                          onClick={() => {
                            setAddNew(false)
                            slot.add(value)
                            setValue('')
                          }}
                        >
                          OK
                        </Button>
                        <Button
                          color="primary"
                          variant="contained"
                          style={{ margin: 2 }}
                          onClick={() => {
                            setAddNew(false)
                            setValue('')
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </ListItem>
        ) : null}
        <Button
          color="primary"
          variant="contained"
          style={{ margin: 4 }}
          disabled={addNew}
          onClick={() => {
            setAddNew(true)
          }}
        >
          Add item
        </Button>
      </List>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default StringArrayEditor
