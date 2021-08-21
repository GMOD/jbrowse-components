import React, { useState } from 'react'
import fs from 'fs'
import {
  Grid,
  IconButton,
  Button,
  InputLabel,
  FormControl,
  Select,
  makeStyles,
} from '@material-ui/core'
import PlayButton from '@material-ui/icons/PlayCircleFilledWhite'
import electron from 'electron'
import { RootModel } from '../rootModel'

const preloadedSessions = {
  hg38: {},
}

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    maxWidth: 300,
  },
}))
const { ipcRenderer } = electron

export default function StartScreenOptionsPanel({
  rootModel,
}: {
  rootModel: RootModel
}) {
  const classes = useStyles()
  const [assemblyChoice, setAssemblyChoice] = useState('hg38')
  return (
    <Grid item xs={4}>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <Button variant="contained" color="primary">
            Open sequence file
          </Button>
        </Grid>
        <Grid item>
          <Button variant="contained" color="primary">
            Open data directory
          </Button>
        </Grid>

        <Grid item>
          <FormControl className={classes.formControl}>
            <InputLabel shrink htmlFor="select-multiple-native">
              Pre-loaded datasets
            </InputLabel>
            <Select
              value={assemblyChoice}
              onChange={event =>
                setAssemblyChoice(event.target.value as string)
              }
            >
              {['hg38', 'hg19', 'mm10', 'mm11', 'rn6'].map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
            <IconButton
              onClick={async () => {
                // @ts-ignore
                const session = preloadedSessions[assemblyChoice]
                rootModel.activateSession(session)
              }}
            >
              <PlayButton />
            </IconButton>
          </FormControl>
        </Grid>
      </Grid>
    </Grid>
  )
}
