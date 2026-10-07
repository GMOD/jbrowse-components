import { useState } from 'react'

import AddIcon from '@mui/icons-material/Add'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { ReactNode } from 'react'

// shared "add new" entry field used by the string-array and map slot editors:
// a text box that commits its contents via onAdd and clears itself
const AddNewField = observer(function AddNewField({
  onAdd,
  testid,
  startAdornment,
}: {
  onAdd: (value: string) => void
  testid?: string
  startAdornment?: ReactNode
}) {
  const [value, setValue] = useState('')
  function commit() {
    if (value !== '') {
      onAdd(value)
      setValue('')
    }
  }
  return (
    <TextField
      fullWidth
      value={value}
      placeholder="add new"
      onChange={event => {
        setValue(event.target.value)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          commit()
        }
      }}
      slotProps={{
        input: {
          startAdornment,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                data-testid={testid}
                disabled={value === ''}
                onClick={() => {
                  commit()
                }}
              >
                <AddIcon />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
})

export default AddNewField
