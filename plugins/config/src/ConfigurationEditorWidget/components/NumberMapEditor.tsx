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
import NumberEditor from './NumberEditor'

const useStyles = makeStyles()(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

const NumberMapEditor = observer(function ({
  slot,
}: {
  slot: {
    name: string
    value: Map<string, string>
    remove: (key: string) => void
    add: (key: string, val: number) => void
    description: string
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
            <NumberEditor
              slot={{
                value: val,
                set: (val: number) => {
                  slot.add(key, val)
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
                          slot.add(value, 0)
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

export default NumberMapEditor
