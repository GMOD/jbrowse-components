import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SequenceSearchModel } from '../model.ts'

const useStyles = makeStyles()({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
  },
  row: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
  },
  grow: {
    flexGrow: 1,
  },
})

function parseFasta(input: string) {
  const lines = input.trim().split('\n')
  const seqLines: string[] = []
  for (const line of lines) {
    if (!line.startsWith('>')) {
      seqLines.push(line.trim())
    }
  }
  return seqLines.join('')
}

const SearchForm = observer(function SearchForm({
  model,
}: {
  model: SequenceSearchModel
}) {
  const { classes } = useStyles()
  const { assemblyNames, assemblyName, searchType, loading } = model
  const [inputText, setInputText] = useState('')

  const selectedAssembly = assemblyName || assemblyNames[0] || ''

  return (
    <div className={classes.form}>
      <Typography variant="body2">
        Enter a DNA or protein sequence to search using BLAT. The search uses
        the UCSC Genome Browser BLAT server.
      </Typography>

      <TextField
        label="Sequence (FASTA or raw)"
        multiline
        rows={6}
        value={inputText}
        onChange={e => setInputText(e.target.value)}
        placeholder=">optional header\nACGTACGTACGTACGT..."
        variant="outlined"
        fullWidth
        slotProps={{
          input: {
            style: { fontFamily: 'monospace' },
          },
        }}
      />

      <div className={classes.row}>
        <FormControl className={classes.grow}>
          <InputLabel>Assembly</InputLabel>
          <Select
            value={selectedAssembly}
            label="Assembly"
            onChange={e => model.setAssemblyName(e.target.value)}
          >
            {assemblyNames.map(name => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl className={classes.grow}>
          <InputLabel>Search type</InputLabel>
          <Select
            value={searchType}
            label="Search type"
            onChange={e =>
              model.setSearchType(
                e.target.value as
                  | 'DNA'
                  | 'protein'
                  | 'translated RNA'
                  | 'translated DNA',
              )
            }
          >
            <MenuItem value="DNA">DNA</MenuItem>
            <MenuItem value="protein">Protein</MenuItem>
            <MenuItem value="translated RNA">Translated RNA</MenuItem>
            <MenuItem value="translated DNA">Translated DNA</MenuItem>
          </Select>
        </FormControl>
      </div>

      <Button
        variant="contained"
        color="primary"
        disabled={loading || !inputText.trim()}
        onClick={() => {
          model.setSequence(parseFasta(inputText))
          model.runSearch()
        }}
      >
        {loading ? 'Searching...' : 'Search'}
      </Button>
    </div>
  )
})

export default SearchForm
