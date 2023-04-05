import React, { useState } from 'react'
import { observer } from 'mobx-react'

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
import { makeStyles } from 'tss-react/mui'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import NumberEditor from './NumberEditor'

const useStyles = makeStyles()(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

export default observer(function ({
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
              <IconButton onClick={() => slot.remove(key)}>
                <DeleteIcon />
              </IconButton>
            }
          />
          <CardContent>
            <NumberEditor
              slot={{
                value: val,
                set: (val: number) => slot.add(key, val),
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
              onChange={event => setValue(event.target.value)}
              InputProps={{
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
              }}
            />
          }
        />
      </Card>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})
