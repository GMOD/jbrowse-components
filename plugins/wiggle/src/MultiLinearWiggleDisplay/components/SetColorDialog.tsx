import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import ColorPicker from './ColorPicker'
import { useShiftSelected } from './useShiftSelected'
import { useSelected } from './useSelected'

// icons
import CloseIcon from '@mui/icons-material/Close'
import { Source } from '../../util'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function SetColorDialog({
  model,
  handleClose,
}: {
  model: {
    color: number
    setColor: (arg?: string) => void
    setPosColor: (arg?: string) => void
    setNegColor: (arg?: string) => void
    sources: Source[]
    setSources: (s: Source[]) => void
    setCustomColors: (s: Record<string, string>) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { sources } = model
  const [colors, setColors] = useState(sources || [])
  const { selected, add, clear, change } = useSelected([] as Source[])
  const onChange = useShiftSelected(sources, change)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Multi-wiggle color select
        <IconButton className={classes.closeButton} onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>
          You can select rows in the table with the checkbox to change the color
          on multiple subtracks at a time. Multi-select is enabled with
          shift-click.
        </Typography>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => add(sources)}>Select all</button>
          <button onClick={clear}>Select none</button>
        </div>
        {selected.length ? (
          <div style={{ position: 'sticky', top: 0, right: 0 }}>
            <div style={{ display: 'flex' }}>
              <div style={{ flexGrow: 1 }} />
              <Typography>Change color of selected items</Typography>
              <ColorPicker
                color="blue"
                onChange={c => {
                  selected.forEach(s => {
                    s.color = c
                  })
                  setColors([...colors])
                }}
              />
            </div>
          </div>
        ) : null}
        <table>
          <thead>
            <tr>
              <th>selected ({selected.length}) </th>
              <th>color</th>
              <th>source</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(source => (
              <tr key={JSON.stringify(source)}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(source)}
                    onChange={event => onChange(event, source)}
                  />
                </td>
                <td style={{ background: source.color }}> </td>
                <td>{source.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          type="submit"
          color="inherit"
          onClick={() => setColors([])}
        >
          Clear custom colors
        </Button>
        <Button
          variant="contained"
          color="secondary"
          type="submit"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          onClick={() => {
            model.setCustomColors(
              Object.fromEntries(
                sources.map((s, i) => [s.name, colors[i].color || 'blue']),
              ),
            )
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
