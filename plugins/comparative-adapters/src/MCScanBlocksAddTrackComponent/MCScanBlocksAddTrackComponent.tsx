import { useEffect, useState } from 'react'

import { AssemblySelector, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { FileLocation } from '@jbrowse/core/util'

interface TrackModel {
  setMixinData: (data: Record<string, unknown>) => void
}

interface GenomeColumn {
  assembly: string
  bed?: FileLocation
}

// Add-track form for a multi-genome MCScan .blocks file. The file has one column
// per genome (column 0 is the reference), so this collects an ordered list of
// (assembly, BED) columns plus the pair this track draws. The same file backs
// the N-1 tracks of a multi-way view; each track picks a different pair.
const MCScanBlocksAddTrackComponent = observer(
  function MCScanBlocksAddTrackComponent({ model }: { model: TrackModel }) {
    const session = getSession(model)
    const defaultAsm = session.assemblies[0]?.name ?? ''
    const [columns, setColumns] = useState<GenomeColumn[]>([
      { assembly: defaultAsm },
      { assembly: session.assemblies[1]?.name ?? defaultAsm },
    ])
    const [pair, setPair] = useState<[string, string]>([
      defaultAsm,
      session.assemblies[1]?.name ?? defaultAsm,
    ])

    useEffect(() => {
      model.setMixinData({
        adapter: {
          blockAssemblies: columns.map(c => c.assembly),
          bedLocations: columns.map(c => c.bed),
          assemblyNames: pair,
        },
      })
      return () => {
        try {
          model.setMixinData({})
        } catch {
          // widget may already be detached during teardown (submit); ignore
        }
      }
    }, [model, columns, pair])

    const setColumn = (idx: number, patch: Partial<GenomeColumn>) => {
      setColumns(columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
    }
    const assemblyOptions = columns.map(c => c.assembly)

    return (
      <div style={{ marginTop: 20 }}>
        <Typography>
          A .blocks file has one column per genome (column 1 is the reference).
          List each genome with its BED file, then choose the pair this track
          draws.
        </Typography>
        {columns.map((col, idx) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- column position is the identity (it maps to a blocks-file column); assemblies can repeat
          <div key={idx} style={{ marginTop: 10 }}>
            <AssemblySelector
              session={session}
              label={idx === 0 ? 'Reference (column 1)' : `Column ${idx + 1}`}
              helperText=""
              selected={col.assembly}
              onChange={asm => {
                setColumn(idx, { assembly: asm })
              }}
              fullWidth
            />
            <FileSelector
              name={`Column ${idx + 1} BED`}
              inline
              description=""
              location={col.bed}
              setLocation={loc => {
                setColumn(idx, { bed: loc })
              }}
            />
            <Tooltip
              title={
                columns.length <= 2
                  ? 'A blocks comparison needs at least 2 genomes'
                  : 'Remove this genome column'
              }
            >
              <span>
                <Button
                  size="small"
                  disabled={columns.length <= 2}
                  onClick={() => {
                    setColumns(columns.filter((_, i) => i !== idx))
                  }}
                >
                  Remove
                </Button>
              </span>
            </Tooltip>
          </div>
        ))}
        <Button
          variant="outlined"
          style={{ marginTop: 10 }}
          onClick={() => {
            setColumns([...columns, { assembly: defaultAsm }])
          }}
        >
          Add genome column
        </Button>
        <div style={{ marginTop: 20 }}>
          <Typography>Pair this track draws</Typography>
          {([0, 1] as const).map(side => (
            <TextField
              key={side}
              select
              label={side === 0 ? 'Assembly 1' : 'Assembly 2'}
              value={pair[side]}
              onChange={event => {
                setPair(
                  side === 0
                    ? [event.target.value, pair[1]]
                    : [pair[0], event.target.value],
                )
              }}
              fullWidth
              margin="dense"
            >
              {assemblyOptions.map((asm, i) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- options mirror the column list, which is position-indexed
                <MenuItem key={`${asm}-${i}`} value={asm}>
                  {asm}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </div>
      </div>
    )
  },
)

export default MCScanBlocksAddTrackComponent
