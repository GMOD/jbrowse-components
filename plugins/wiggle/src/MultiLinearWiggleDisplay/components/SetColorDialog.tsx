import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import ColorPicker from './ColorPicker'
import { useShiftSelected } from './useShiftSelected'
import { useSelected } from './useSelected'

// icons
import CloseIcon from '@mui/icons-material/Close'
import { Source } from '../../util'
import Delete from '@mui/icons-material/Delete'

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
  const [colors, setColors] = useState(sources || {})
  const { selected, change } = useSelected([] as Source[])
  const onChange = useShiftSelected(sources, change)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        <Typography>
          Select either an overall color, or the positive/negative colors. Note
          that density renderers only work properly with positive/negative
          colors
        </Typography>
        <IconButton className={classes.closeButton} onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div style={{ display: 'flex' }}>
          <div style={{ flexGrow: 1 }} />
          {selected.length ? (
            <div>
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
          ) : null}
        </div>

        <table>
          <thead>
            <tr>
              <th>
                selected{' '}
                <IconButton onClick={() => change(false, [])}>
                  <Delete />
                </IconButton>
              </th>
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
