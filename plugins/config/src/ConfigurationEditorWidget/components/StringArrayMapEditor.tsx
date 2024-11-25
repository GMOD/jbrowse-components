import React, { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Card,
  CardContent,
  CardHeader,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from 'tss-react/mui'

// icons

// locals
import StringArrayEditor from './StringArrayEditor'

const useStyles = makeStyles()(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

const StringArrayMapEditor = observer(function ({
  slot,
}: {
  slot: {
    name: string
    value: Map<string, string[]>
    remove: (key: string) => void
    add: (key: string, val: string[]) => void
    description: string
    setAtKeyIndex: (key: string, idx: number, val: string) => void
    removeAtKeyIndex: (key: string, idx: number) => void
    addToKey: (key: string, val: string) => void
  }
}) {
  const { classes } = useStyles()
  const [value, setValue] = useState('')
  return (
    <>
      <InputLabel>{slot.name}</InputLabel>
      {[...slot.value].map(([key, val]) => (
        <Card raised key={key} className={classes.card}>
          <CardHeader
            title={key}
            action={
              <IconButton
                onClick={() => {
                  slot.remove(key)
                }}
              >
                <DeleteIcon />
              </IconButton>
            }
          />
          <CardContent>
            <StringArrayEditor
              slot={{
                name: slot.name,
                value: val,
                description: `Values associated with entry ${key}`,
                setAtIndex: (idx: number, val: string) => {
                  slot.setAtKeyIndex(key, idx, val)
                },
                removeAtIndex: (idx: number) => {
                  slot.removeAtKeyIndex(key, idx)
                },
                add: (val: string) => {
                  slot.addToKey(key, val)
                },
              }}
            />
          </CardContent>
        </Card>
      ))}
      <Card raised className={classes.card}>
        <CardHeader
          disableTypography
          title={
            <TextField
              fullWidth
              value={value}
              placeholder="add new"
              onChange={event => {
                setValue(event.target.value)
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        disabled={value === ''}
                        onClick={() => {
                          slot.add(value, [])
                          setValue('')
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          }
        />
      </Card>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default StringArrayMapEditor
