import { useEffect, useState } from 'react'

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
  Paper,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AddTrackModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  paper: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
  },

  card: {
    marginTop: theme.spacing(1),
  },
}))

const TextIndexingConfig = observer(function TextIndexingConfig({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const [attributeInput, setAttributeInput] = useState('')
  const [excludeInput, setExcludeInput] = useState('')
  const [attributes, setAttributes] = useState(['Name', 'ID'])
  const [exclude, setExclude] = useState(['CDS', 'exon'])
  const sections = [
    {
      label: 'Indexing attributes',
      values: attributes,
      setValues: setAttributes,
      inputValue: attributeInput,
      setInputValue: setAttributeInput,
    },
    {
      label: 'Feature types to exclude',
      values: exclude,
      setValues: setExclude,
      inputValue: excludeInput,
      setInputValue: setExcludeInput,
    },
  ]
  useEffect(() => {
    model.setTextIndexingConf({ attributes, exclude })
  }, [model, attributes, exclude])

  return (
    <Paper className={classes.paper}>
      <InputLabel>Indexing configuration</InputLabel>
      {sections.map(section => (
        <Card raised key={section.label} className={classes.card}>
          <CardContent>
            <InputLabel>{section.label}</InputLabel>
            <List disablePadding>
              {section.values.map((val, idx) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: */
                <ListItem key={`${val}-${idx}`} disableGutters>
                  <TextField
                    value={val}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => {
                                section.setValues(
                                  section.values.filter((_, i) => i !== idx),
                                )
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
                  value={section.inputValue}
                  placeholder="add new"
                  onChange={event => {
                    section.setInputValue(event.target.value)
                  }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => {
                              section.setValues([
                                ...section.values,
                                section.inputValue,
                              ])
                              section.setInputValue('')
                            }}
                            disabled={section.inputValue === ''}
                            data-testid="stringArrayAdd-Feat"
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
      ))}
    </Paper>
  )
})

export default TextIndexingConfig
