import { useMemo, useState } from 'react'

import { fetchResults } from '@jbrowse/core/TextSearch/fetchResults'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  AssemblySelector,
  ErrorBanner,
  LoadingEllipses,
  RefNameAutocomplete,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  MenuItem,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
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

// Parses `chr1:1,000-2,000`. Returns 0-based half-open [start, end).
function parseRegion(input: string) {
  const s = input.replaceAll(/\s/g, '')
  const lastColon = s.lastIndexOf(':')
  if (lastColon === -1) {
    throw new Error('expected format refName:start-end')
  }
  const refName = s.slice(0, lastColon)
  const coords = s.slice(lastColon + 1).replaceAll(',', '')
  const m = /^(\d+)[-–](\d+)$/.exec(coords)
  if (!m) {
    throw new Error('expected format refName:start-end')
  }
  const start = +m[1]!
  const end = +m[2]!
  if (!(start < end)) {
    throw new Error('start must be less than end')
  }
  return { refName, start, end }
}

type Mode = 'track' | 'file'

const TrackMode = observer(function TrackMode({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const session = getSession(model)
  const { assemblyNames } = session
  const [assembly, setAssembly] = useState(assemblyNames[0] ?? '')
  const [trackId, setTrackId] = useState('')
  const [loc, setLoc] = useState('')
  const [error, setError] = useState<unknown>()

  const gfaTabixTracks = useMemo(
    () =>
      session.tracks.filter(track => {
        const adapterType = readConfObject(track, ['adapter', 'type']) as
          | string
          | undefined
        if (adapterType !== 'GfaTabixAdapter') {
          return false
        }
        const trackAssemblies = readConfObject(track, 'assemblyNames') as
          | string[]
          | undefined
        return !assembly || !trackAssemblies?.length
          ? true
          : trackAssemblies.includes(assembly)
      }),
    [session.tracks, assembly],
  )

  const selectedTrack = gfaTabixTracks.find(t => t.trackId === trackId)

  if (assemblyNames.length === 0) {
    return <ErrorBanner error="No assemblies configured in this session" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <AssemblySelector
          session={session}
          selected={assembly}
          onChange={v => {
            setAssembly(v)
            setTrackId('')
          }}
        />
        <div data-testid="gfa-track-field" style={{ flex: 1, minWidth: 180 }}>
          <TextField
            select
            size="small"
            label="GFA track"
            variant="outlined"
            value={trackId}
            onChange={e => {
              setTrackId(e.target.value)
            }}
            disabled={gfaTabixTracks.length === 0}
            style={{ width: '100%' }}
            helperText={
              gfaTabixTracks.length === 0
                ? `No GFA tracks for ${assembly || 'this assembly'}`
                : ' '
            }
          >
            {gfaTabixTracks.map(track => (
              <MenuItem key={track.trackId} value={track.trackId}>
                {readConfObject(track, 'name') as string}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div data-testid="gfa-loc-field" style={{ flex: 1 }}>
          <RefNameAutocomplete
            session={session}
            assemblyName={assembly}
            value={loc}
            fetchResults={q =>
              fetchResults({ queryString: q, session, assemblyName: assembly })
            }
            onChange={setLoc}
            onSelect={result => {
              setLoc(result.getLocation() ?? result.getLabel())
            }}
            minWidth={240}
            maxWidth={400}
            helperText="Refname, gene/feature name, or refname:start-end"
          />
        </div>
        <Button
          data-testid="gfa-open-btn"
          variant="contained"
          onClick={async () => {
            setError(undefined)
            try {
              if (!selectedTrack) {
                throw new Error('Pick a GfaTabix track')
              }
              // If the user picked a feature (e.g. a gene) from the autocomplete,
              // prefer its resolved location; else parse whatever they typed.
              const { refName, start, end } = parseRegion(loc)
              const adapterConfig = readConfObject(selectedTrack, 'adapter')
              await model.loadFromTabixSubgraph(adapterConfig, {
                refName,
                assemblyName: assembly,
                start,
                end,
              })
            } catch (e) {
              setError(e)
            }
          }}
          disabled={!trackId || !loc.trim() || model.isLoading}
        >
          Open
        </Button>
      </div>

      {error ? <ErrorBanner error={error} /> : null}
    </div>
  )
})

function FileMode({ model }: { model: GraphGenomeViewModel }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<unknown>()

  async function handleUrlLoad() {
    if (!url.trim()) {
      return
    }
    setError(undefined)
    try {
      const text = await openLocation({
        uri: url,
        locationType: 'UriLocation',
      }).readFile('utf8')
      await model.loadGFA(text, url.split('/').pop() ?? 'GFA')
    } catch (e) {
      setError(e)
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      file
        .text()
        .then(text => model.loadGFA(text, file.name))
        .catch((err: unknown) => {
          model.setError(err)
        })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="outlined" component="label" size="small">
          Choose file
          <input
            type="file"
            accept=".gfa,.gfa1,.gfa2"
            hidden
            onChange={handleFileUpload}
          />
        </Button>
        <Typography variant="caption" color="text.secondary">
          Whole-file GFA; best for small/medium graphs.
        </Typography>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <TextField
          size="small"
          label="URL"
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
          style={{ flex: 1 }}
        />
        <Button
          variant="contained"
          onClick={handleUrlLoad}
          disabled={!url.trim() || model.isLoading}
        >
          Open
        </Button>
      </div>

      {error ? <ErrorBanner error={error} /> : null}
    </div>
  )
}

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const [mode, setMode] = useState<Mode>('track')

  return (
    <Paper
      style={{ padding: 16, margin: 8, maxWidth: 560, marginInline: 'auto' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Typography variant="h6">Load a GFA graph</Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, v: Mode | null) => {
            if (v) {
              setMode(v)
            }
          }}
        >
          <ToggleButton value="track">Track</ToggleButton>
          <ToggleButton value="file">File / URL</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {mode === 'track' ? (
        <TrackMode model={model} />
      ) : (
        <FileMode model={model} />
      )}

      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          size="small"
          onClick={() => {
            void model.loadGFA(EXAMPLE_GFA, 'Example graph')
          }}
        >
          Load 4-node example
        </Button>
      </div>

      {model.isLoading ? (
        <LoadingEllipses
          variant="body2"
          message={model.statusMessage || 'Loading'}
        />
      ) : null}

      {model.error ? <ErrorBanner error={model.error} /> : null}
    </Paper>
  )
})

export default ImportForm
