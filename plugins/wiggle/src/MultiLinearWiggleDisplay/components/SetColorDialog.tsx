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
import { hcl } from 'd3-color'
import Picker from './SwatchesPicker'

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

// this is needed because passing a entire color object into the react-color
// for alpha, can't pass in an rgba string for example
function serialize(color: any) {
  if (color instanceof Object) {
    const { r, g, b } = color as any
    return `rgb(${r},${g},${b})`
  }
  return color
}

function ggplotColours(n: number, h = [15, 375]) {
  const colors = []
  const diff = h[1] - h[0]
  for (let i = 0; i < n; i++) {
    const k = h[0] + (diff / n) * i
    colors.push(hcl(k, 150, 65).hex())
  }
  return colors
}

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
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { sources } = model
  const colors = ggplotColours(sources.length)
  const palettes = ['ggplot2', 'set1', 'set2', 'category10']
  const [val, setVal] = useState('ggplot2')

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        <Typography>
          Select either an overall color, or the positive/negative colors. Note
          that density renderers only work properly with positive/negative
          colors
        </Typography>
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Select value={val} onChange={event => setVal(event.target.value)}>
          {palettes.map(p => (
            <MenuItem key={p}>{p}</MenuItem>
          ))}
        </Select>

        <table>
          <thead>
            <tr>
              <th>color</th>
              <th>source</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, i) => (
              <tr key={JSON.stringify(source)}>
                <td style={{ background: colors[i] }}> </td>
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
            model.setSources(
              sources.map((source, i) => ({ ...source, color: colors[i] })),
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
