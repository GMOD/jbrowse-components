import { useState } from 'react'

import { AssemblySelector, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { useSeedTrackMixin } from '../addTrackMixinContribution.ts'

import type { AddTrackComponentModel } from '../addTrackMixinContribution.ts'
import type { FileLocation } from '@jbrowse/core/util'

interface GenomeColumn {
  assembly: string
  bed?: FileLocation
}

function columnsToMixin(columns: GenomeColumn[]) {
  return {
    adapter: {
      blockAssemblies: columns.map(c => c.assembly),
      bedLocations: columns.map(c => c.bed),
      assemblyNames: columns.map(c => c.assembly),
    },
  }
}

// Add-track form for a multi-genome MCScan .blocks file. The file has one column
// per genome (column 0 is the reference), so this collects an ordered list of
// (assembly, BED) columns. One track backs every band of a multi-way view: the
// synteny view tells the adapter which pair each band draws, so assemblyNames is
// just the full genome list.
const MCScanBlocksAddTrackComponent = observer(
  function MCScanBlocksAddTrackComponent({
    model,
  }: {
    model: AddTrackComponentModel
  }) {
    const session = getSession(model)
    const defaultAsm = session.assemblies[0]?.name ?? ''
    const [columns, setColumns] = useState<GenomeColumn[]>([
      { assembly: defaultAsm },
      { assembly: session.assemblies[1]?.name ?? defaultAsm },
    ])

    useSeedTrackMixin(model, columnsToMixin(columns))

    const update = (next: GenomeColumn[]) => {
      setColumns(next)
      model.setMixinData(columnsToMixin(next))
    }

    const setColumn = (idx: number, patch: Partial<GenomeColumn>) => {
      update(columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
    }

    return (
      <div style={{ marginTop: 20 }}>
        <Typography>
          A .blocks file has one column per genome (column 1 is the reference).
          List each genome with its BED file; one track then backs every band of
          the multi-way view.
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
                    update(columns.filter((_, i) => i !== idx))
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
            update([...columns, { assembly: defaultAsm }])
          }}
        >
          Add genome column
        </Button>
      </div>
    )
  },
)

export default MCScanBlocksAddTrackComponent
