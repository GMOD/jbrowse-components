import React, { useEffect, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Card,
  CardContent,
  IconButton,
  InputLabel,
  InputAdornment,
  List,
  ListItem,
  Paper,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import type { AddTrackModel } from '../model'

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

const TextIndexingConfig = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const [value1, setValue1] = useState('')
  const [value2, setValue2] = useState('')
  const [attributes, setAttributes] = useState(['Name', 'ID'])
  const [exclude, setExclude] = useState(['CDS', 'exon'])
  const sections = [
    {
      label: 'Indexing attributes',
      values: attributes,
    },
    {
      label: 'Feature types to exclude',
      values: exclude,
    },
  ]
  useEffect(() => {
    model.setTextIndexingConf({ attributes, exclude })
  }, [model, attributes, exclude])

  return (
    <Paper className={classes.paper}>
      <InputLabel>Indexing configuration</InputLabel>
      {sections.map((section, index) => (
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
                                const newAttr = section.values.filter(
                                  (_, i) => i !== idx,
                                )
                                if (index === 0) {
                                  setAttributes(newAttr)
                                } else {
                                  setExclude(newAttr)
                                }
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
                  value={index === 0 ? value1 : value2}
                  placeholder="add new"
                  onChange={event => {
                    if (index === 0) {
                      setValue1(event.target.value)
                    } else {
                      setValue2(event.target.value)
                    }
                  }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => {
                              if (index === 0) {
                                setAttributes([...attributes, value1])
                                setValue1('')
                              } else {
                                setExclude([...exclude, value2])
                                setValue2('')
                              }
                            }}
                            disabled={
                              index === 0 ? value1 === '' : value2 === ''
                            }
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
