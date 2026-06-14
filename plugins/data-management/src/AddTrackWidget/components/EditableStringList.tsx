import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  TextField,
} from '@mui/material'

const useStyles = makeStyles()(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

/**
 * A labeled, editable list of strings: each existing value is editable inline
 * with a delete button, plus a trailing field that appends a new (trimmed,
 * de-duplicated) value on Enter or via the add button.
 */
export default function EditableStringList({
  label,
  testId,
  values,
  onChange,
}: {
  label: string
  testId: string
  values: string[]
  onChange: (values: string[]) => void
}) {
  const { classes } = useStyles()
  const [input, setInput] = useState('')

  function addValue() {
    const value = input.trim()
    if (value && !values.includes(value)) {
      onChange([...values, value])
    }
    setInput('')
  }

  return (
    <Card raised className={classes.card}>
      <CardContent>
        <InputLabel>{label}</InputLabel>
        <List disablePadding>
          {values.map((val, idx) => (
            /* biome-ignore lint/suspicious/noArrayIndexKey: */
            // eslint-disable-next-line @eslint-react/no-array-index-key -- controlled inputs by position, list order edited via index
            <ListItem key={`${testId}-${idx}`} disableGutters>
              <TextField
                value={val}
                onChange={event => {
                  onChange(
                    values.map((v, i) => (i === idx ? event.target.value : v)),
                  )
                }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => {
                            onChange(values.filter((_, i) => i !== idx))
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
            <TextField
              value={input}
              placeholder="add new"
              onChange={event => {
                setInput(event.target.value)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addValue()
                }
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => {
                          addValue()
                        }}
                        disabled={
                          input.trim() === '' || values.includes(input.trim())
                        }
                        data-testid={testId}
                      >
                        <AddIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  )
}
