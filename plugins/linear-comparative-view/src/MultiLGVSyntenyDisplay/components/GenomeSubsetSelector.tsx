import { useState } from 'react'

import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { Dialog } from '@jbrowse/core/ui'

interface GenomeSubsetModel {
  allGenomeNames: string[]
  selectedGenomes: { length: number } & Iterable<string>
  setSelectedGenomes(genomes: string[]): void
}

const GenomeSubsetSelector = observer(function GenomeSubsetSelector({
  model,
  handleClose,
}: {
  model: GenomeSubsetModel
  handleClose: () => void
}) {
  const [filter, setFilter] = useState('')

  const allNames = model.allGenomeNames
  const selected = new Set(
    model.selectedGenomes.length > 0 ? [...model.selectedGenomes] : allNames,
  )

  const filtered = filter
    ? allNames.filter(n => n.toLowerCase().includes(filter.toLowerCase()))
    : allNames

  return (
    <Dialog
      open
      onClose={handleClose}
      title="Select genomes to display"
      maxWidth="sm"
      fullWidth
    >
      <DialogContent>
        <TextField
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter genomes..."
          size="small"
          fullWidth
          style={{ marginBottom: 8 }}
        />
        <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              model.setSelectedGenomes([...allNames])
            }}
          >
            Select all
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              model.setSelectedGenomes([])
            }}
          >
            Deselect all
          </Button>
        </div>
        <Typography variant="caption" color="textSecondary">
          {selected.size} of {allNames.length} genomes selected
        </Typography>
        <div
          style={{
            maxHeight: 400,
            overflow: 'auto',
            border: '1px solid #e0e0e0',
            borderRadius: 4,
            padding: 4,
          }}
        >
          {filtered.map(name => (
            <FormControlLabel
              key={name}
              style={{ display: 'block' }}
              control={
                <Checkbox
                  size="small"
                  checked={selected.has(name)}
                  onChange={() => {
                    if (selected.has(name)) {
                      selected.delete(name)
                    } else {
                      selected.add(name)
                    }
                    model.setSelectedGenomes(
                      allNames.filter(n => selected.has(n)),
                    )
                  }}
                />
              }
              label={name}
            />
          ))}
          {filtered.length === 0 ? (
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ padding: 8 }}
            >
              No genomes match filter
            </Typography>
          ) : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GenomeSubsetSelector
