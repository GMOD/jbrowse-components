import React, { useState } from 'react'
import { observer } from 'mobx-react'

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

// icons
import DeleteIcon from '@mui/icons-material/Delete'

const StringArrayEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      value: string[]
      setAtIndex: Function
      removeAtIndex: Function
      add: Function
      description: string
    }
  }) => {
    const [value, setValue] = useState('')
    const [addNew, setAddNew] = useState(false)
    return (
      <>
        {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
        <List disablePadding>
          {slot.value.map((val, idx) => (
            <ListItem key={idx} disableGutters>
              <TextField
                value={val}
                onChange={evt => slot.setAtIndex(idx, evt.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => slot.removeAtIndex(idx)}>
                        <DeleteIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </ListItem>
          ))}

          {addNew ? (
            <ListItem disableGutters>
              <TextField
                value={value}
                placeholder="add new"
                onChange={event => setValue(event.target.value)}
                InputProps={{
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
                }}
              />
            </ListItem>
          ) : null}
          <Button
            color="primary"
            variant="contained"
            style={{ margin: 4 }}
            disabled={addNew}
            onClick={() => setAddNew(true)}
          >
            Add item
          </Button>
        </List>
        <FormHelperText>{slot.description}</FormHelperText>
      </>
    )
  },
)

export default StringArrayEditor
