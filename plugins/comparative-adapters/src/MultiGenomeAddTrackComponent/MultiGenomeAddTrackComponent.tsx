import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { useSeedTrackMixin } from '../addTrackMixinContribution.ts'

import type { AddTrackComponentModel } from '@jbrowse/core/util'

// The assembly names are assumed to match the PanSN sample prefixes; a mismatch
// is rare enough to configure via the assemblyNameToPanSN slot in the config
// editor.
const MultiGenomeAddTrackComponent = observer(
  function MultiGenomeAddTrackComponent({
    model,
  }: {
    model: AddTrackComponentModel
  }) {
    const session = getSession(model)
    const defaultAsm = session.assemblies[0]?.name ?? ''
    const [assemblyNames, setAssemblyNames] = useState<string[]>([
      defaultAsm,
      session.assemblies[1]?.name ?? defaultAsm,
    ])

    // the same list goes on the track and on the adapter: the adapter uses it to
    // label mates, while the track needs it to be offered by the track selector of
    // a multi-way view (which only shows tracks covering every displayed assembly)
    useSeedTrackMixin(model, {
      assemblyNames,
      adapter: { assemblyNames },
    })

    function update(next: string[]) {
      setAssemblyNames(next)
      model.setMixinData({
        assemblyNames: next,
        adapter: { assemblyNames: next },
      })
    }

    return (
      <>
        <Typography>
          A PAF (or its tabix-indexed <code>.pif.gz</code> form) aligning
          several assemblies, whether every pair of them or each against one
          reference. List the assemblies the file covers; the sequence names
          must be PanSN-prefixed with their assembly (e.g.{' '}
          <code>grape#1#chr1</code>).
        </Typography>
        {assemblyNames.map((assemblyName, idx) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- list position is the identity; assemblies can repeat while the user edits
          <div key={idx}>
            <AssemblySelector
              session={session}
              label={`Assembly ${idx + 1}`}
              helperText=""
              selected={assemblyName}
              onChange={asm => {
                update(assemblyNames.map((a, i) => (i === idx ? asm : a)))
              }}
              fullWidth
            />
            <Tooltip
              title={
                assemblyNames.length <= 2
                  ? 'A multi-genome file needs at least 2 assemblies'
                  : 'Remove this assembly'
              }
            >
              <span>
                <Button
                  size="small"
                  disabled={assemblyNames.length <= 2}
                  onClick={() => {
                    update(assemblyNames.filter((_, i) => i !== idx))
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
            update([...assemblyNames, defaultAsm])
          }}
        >
          Add assembly
        </Button>
      </>
    )
  },
)

export default MultiGenomeAddTrackComponent
