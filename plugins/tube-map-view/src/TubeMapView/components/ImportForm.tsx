import { useState } from 'react'

import {
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { TubeMapViewModel } from '../model.ts'

const EXAMPLE_GFA = `H\tVN:Z:1.0
S\t1\tCAAATAAG
S\t2\tA
S\t3\tG
S\t4\tT
S\t5\tC
S\t6\tTTG
S\t7\tA
S\t8\tG
S\t9\tAAATTTTCTGGAGTTCTAT
S\t10\tA
S\t11\tT
S\t12\tATAT
S\t13\tA
S\t14\tT
S\t15\tCCAACTCTCTG
L\t1\t+\t2\t+\t0M
L\t1\t+\t3\t+\t0M
L\t2\t+\t4\t+\t0M
L\t2\t+\t5\t+\t0M
L\t3\t+\t4\t+\t0M
L\t3\t+\t5\t+\t0M
L\t4\t+\t6\t+\t0M
L\t5\t+\t6\t+\t0M
L\t6\t+\t7\t+\t0M
L\t6\t+\t8\t+\t0M
L\t7\t+\t9\t+\t0M
L\t8\t+\t9\t+\t0M
L\t9\t+\t10\t+\t0M
L\t9\t+\t11\t+\t0M
L\t10\t+\t12\t+\t0M
L\t11\t+\t12\t+\t0M
L\t12\t+\t13\t+\t0M
L\t12\t+\t14\t+\t0M
L\t13\t+\t15\t+\t0M
L\t14\t+\t15\t+\t0M
P\tx\t1+,3+,5+,6+,8+,9+,11+,12+,14+,15+\t*
P\ty\t1+,2+,4+,6+,7+,9+,10+,12+,13+,15+\t*`

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: TubeMapViewModel
}) {
  const [url, setUrl] = useState('')
  const [fetchError, setFetchError] = useState('')

  async function handleUrlLoad() {
    if (url.trim()) {
      setFetchError('')
      const response = await fetch(url)
      if (response.ok) {
        const text = await response.text()
        model.loadGFA(text)
      } else {
        setFetchError(`Failed to fetch: ${response.statusText}`)
      }
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      file
        .text()
        .then(text => {
          model.loadGFA(text)
        })
        .catch((err: unknown) => {
          model.setError(`Failed to read file: ${err}`)
        })
    }
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
        <Button variant="outlined" onClick={() => model.loadGFA(EXAMPLE_GFA)}>
          Load example (tiny pangenome, 15 nodes, 2 haplotypes)
        </Button>
      </div>

      {model.isLoading ? (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" style={{ marginTop: 8 }}>
            Computing layout...
          </Typography>
        </div>
      ) : null}

      {model.error ? (
        <Typography color="error" variant="body2" style={{ marginTop: 8 }}>
          {model.error}
        </Typography>
      ) : null}
    </Paper>
  )
})

export default ImportForm
