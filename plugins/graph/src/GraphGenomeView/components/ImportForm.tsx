import { useState } from 'react'

import {
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { observer } from 'mobx-react'

import type { GraphGenomeViewModel } from '../model.ts'

const EXAMPLE_GFA = `H\tVN:Z:1.0
S\t1\tACGT
S\t2\tGGCC
S\t3\tTTAA
S\t4\tCCGG
L\t1\t+\t2\t+\t0M
L\t1\t+\t3\t+\t0M
L\t2\t+\t4\t+\t0M
L\t3\t+\t4\t+\t0M`

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const [url, setUrl] = useState('')
  const [fetchError, setFetchError] = useState('')

  async function handleUrlLoad() {
    if (!url.trim()) {
      return
    }
    setFetchError('')
    try {
      const response = await fetch(url)
      if (!response.ok) {
        setFetchError(`Failed to fetch: ${response.statusText}`)
        return
      }
      const text = await response.text()
      await model.loadGFA(text, url.split('/').pop() ?? 'GFA')
    } catch (e) {
      setFetchError(`Failed to fetch: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    file
      .text()
      .then(text => model.loadGFA(text, file.name))
      .catch((err: unknown) => {
        model.setError(err)
      })
  }

  function handleExampleLoad() {
    void model.loadGFA(EXAMPLE_GFA, 'Example graph')
  }

  return (
    <Paper
      style={{ padding: 24, margin: 8, maxWidth: 600, marginInline: 'auto' }}
    >
      <Typography variant="h6" gutterBottom>
        Load a GFA graph
      </Typography>

      <div style={{ marginBottom: 16 }}>
        <Typography variant="subtitle2" gutterBottom>
          From file
        </Typography>
        <Button variant="outlined" component="label">
          Choose GFA file
          <input
            type="file"
            accept=".gfa,.gfa1,.gfa2"
            hidden
            onChange={handleFileUpload}
          />
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Typography variant="subtitle2" gutterBottom>
          From URL
        </Typography>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="https://example.com/graph.gfa"
            value={url}
            onChange={e => {
              setUrl(e.target.value)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                void handleUrlLoad()
              }
            }}
          />
          <Button
            variant="contained"
            onClick={handleUrlLoad}
            disabled={!url.trim() || model.isLoading}
          >
            Load
          </Button>
        </div>
        {fetchError ? (
          <Typography color="error" variant="body2" style={{ marginTop: 4 }}>
            {fetchError}
          </Typography>
        ) : null}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Typography variant="subtitle2" gutterBottom>
          Example
        </Typography>
        <Button variant="outlined" onClick={handleExampleLoad}>
          Load example graph (4 nodes)
        </Button>
      </div>

      {model.isLoading ? (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" style={{ marginTop: 8 }}>
            Loading...
          </Typography>
        </div>
      ) : null}

      {model.error ? <ErrorMessage error={model.error} /> : null}
    </Paper>
  )
})

export default ImportForm
