import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
  primerInputs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  advancedRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  smallInput: {
    width: '120px',
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
  const {
    assemblyNames,
    assembliesWithDisplayNames,
    assemblyName,
    searchType,
    transBlatType,
    loading,
    mode,
    forwardPrimer,
    reversePrimer,
    maxProductSize,
    minPerfect,
    minGood,
  } = model
  const [inputText, setInputText] = useState('')

  const selectedAssembly = assemblyName || assemblyNames[0] || ''

  const canSearch =
    mode === 'isPcr'
      ? forwardPrimer.trim().length >= 15 && reversePrimer.trim().length >= 15
      : inputText.trim().length > 0

  const getButtonText = () => {
    if (loading) {
      return 'Searching...'
    }
    if (mode === 'blat') {
      return 'Search'
    }
    if (mode === 'transBlat') {
      return 'Translated Search'
    }
    return 'Find PCR Products'
  }

  return (
    <div className={classes.form}>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, newMode) => {
          if (newMode) {
            model.setMode(newMode)
            model.clearResults()
          }
        }}
        size="small"
      >
        <ToggleButton value="blat">BLAT</ToggleButton>
        <ToggleButton value="transBlat">transBlat</ToggleButton>
        <ToggleButton value="isPcr">In-Silico PCR</ToggleButton>
      </ToggleButtonGroup>

      {mode === 'blat' && (
        <>
          <Typography variant="body2">
            Enter a DNA or protein sequence to search using BLAT. The search
            uses the UCSC Genome Browser BLAT server.
          </Typography>

          <TextField
            label="Sequence (FASTA or raw)"
            multiline
            rows={6}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder=">optional header&#10;ACGTACGTACGTACGT..."
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
                {assembliesWithDisplayNames.map(asm => (
                  <MenuItem key={asm.name} value={asm.name}>
                    {asm.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl className={classes.grow}>
              <InputLabel>Query type</InputLabel>
              <Select
                value={searchType}
                label="Query type"
                onChange={e => model.setSearchType(e.target.value)}
              >
                <MenuItem value="DNA">DNA</MenuItem>
                <MenuItem value="protein">Protein</MenuItem>
              </Select>
            </FormControl>
          </div>
        </>
      )}

      {mode === 'transBlat' && (
        <>
          <Typography variant="body2">
            Enter a DNA sequence to search against the translated genome using
            transBlat. This is useful for finding protein-coding regions or
            searching across species with divergent DNA but similar proteins.
          </Typography>

          <TextField
            label="DNA Sequence (FASTA or raw)"
            multiline
            rows={6}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder=">optional header&#10;ATGACGTACGTACGT..."
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
                {assembliesWithDisplayNames.map(asm => (
                  <MenuItem key={asm.name} value={asm.name}>
                    {asm.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl className={classes.grow}>
              <InputLabel>Search mode</InputLabel>
              <Select
                value={transBlatType}
                label="Search mode"
                onChange={e => model.setTransBlatType(e.target.value)}
              >
                <MenuItem value="translated DNA">
                  DNA vs translated genome
                </MenuItem>
                <MenuItem value="translated RNA">
                  RNA vs translated genome
                </MenuItem>
              </Select>
            </FormControl>
          </div>
        </>
      )}

      {mode === 'isPcr' && (
        <>
          <Typography variant="body2">
            Enter forward and reverse primers to find PCR products in the
            genome. Primers must be at least 15 bases. Uses the UCSC In-Silico
            PCR server.
          </Typography>

          <div className={classes.primerInputs}>
            <TextField
              label="Forward primer (5' → 3')"
              value={forwardPrimer}
              onChange={e =>
                model.setForwardPrimer(e.target.value.toUpperCase())
              }
              placeholder="ACGTACGTACGTACGT"
              variant="outlined"
              fullWidth
              slotProps={{
                input: {
                  style: { fontFamily: 'monospace' },
                },
              }}
              helperText={
                forwardPrimer.length > 0 && forwardPrimer.length < 15
                  ? `${forwardPrimer.length}/15 bases (minimum 15 required)`
                  : undefined
              }
              error={forwardPrimer.length > 0 && forwardPrimer.length < 15}
            />

            <TextField
              label="Reverse primer (5' → 3')"
              value={reversePrimer}
              onChange={e =>
                model.setReversePrimer(e.target.value.toUpperCase())
              }
              placeholder="TGCATGCATGCATGCA"
              variant="outlined"
              fullWidth
              slotProps={{
                input: {
                  style: { fontFamily: 'monospace' },
                },
              }}
              helperText={
                reversePrimer.length > 0 && reversePrimer.length < 15
                  ? `${reversePrimer.length}/15 bases (minimum 15 required)`
                  : undefined
              }
              error={reversePrimer.length > 0 && reversePrimer.length < 15}
            />
          </div>

          <FormControl fullWidth>
            <InputLabel>Assembly</InputLabel>
            <Select
              value={selectedAssembly}
              label="Assembly"
              onChange={e => model.setAssemblyName(e.target.value)}
            >
              {assembliesWithDisplayNames.map(asm => (
                <MenuItem key={asm.name} value={asm.name}>
                  {asm.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Advanced options</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <div className={classes.advancedRow}>
                <TextField
                  label="Max product size"
                  type="number"
                  value={maxProductSize}
                  onChange={e =>
                    model.setMaxProductSize(Number(e.target.value))
                  }
                  className={classes.smallInput}
                  size="small"
                  slotProps={{ htmlInput: { min: 100, max: 100000 } }}
                />
                <TextField
                  label="Min perfect match"
                  type="number"
                  value={minPerfect}
                  onChange={e => model.setMinPerfect(Number(e.target.value))}
                  className={classes.smallInput}
                  size="small"
                  slotProps={{ htmlInput: { min: 10, max: 25 } }}
                />
                <TextField
                  label="Min good match"
                  type="number"
                  value={minGood}
                  onChange={e => model.setMinGood(Number(e.target.value))}
                  className={classes.smallInput}
                  size="small"
                  slotProps={{ htmlInput: { min: 10, max: 25 } }}
                />
              </div>
            </AccordionDetails>
          </Accordion>
        </>
      )}

      <Button
        variant="contained"
        color="primary"
        disabled={loading || !canSearch}
        onClick={() => {
          if (mode === 'blat' || mode === 'transBlat') {
            model.setSequence(parseFasta(inputText))
          }
          model.runSearch()
        }}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
      >
        {getButtonText()}
      </Button>
    </div>
  )
})

export default SearchForm
