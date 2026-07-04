import { useEffect, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

interface TrackModel {
  setMixinData: (data: Record<string, unknown>) => void
}

// Add-track form for an all-vs-all PAF: the file contains every pairwise
// alignment, so one track can back every band of a multi-way view. List all the
// assemblies the file covers; the synteny view then picks each band's pair. The
// assembly names are assumed to match the PanSN sample prefixes; a mismatch is
// rare enough to configure via the assemblyNameToPanSN slot in the config editor.
const AllVsAllAddTrackComponent = observer(function AllVsAllAddTrackComponent({
  model,
}: {
  model: TrackModel
}) {
  const session = getSession(model)
  const defaultAsm = session.assemblies[0]?.name ?? ''
  const [assemblyNames, setAssemblyNames] = useState<string[]>([
    defaultAsm,
    session.assemblies[1]?.name ?? defaultAsm,
  ])

  useEffect(() => {
    model.setMixinData({ adapter: { assemblyNames } })
    return () => {
      try {
        model.setMixinData({})
      } catch {
        // widget may already be detached during teardown (submit); ignore
      }
    }
  }, [model, assemblyNames])

  return (
    <>
      <Typography>
        An all-vs-all PAF contains every pairwise alignment, so one track backs
        every band of a multi-way view. List the assemblies the file covers; the
        sequence names must be PanSN-prefixed with their assembly (e.g.{' '}
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
              setAssemblyNames(
                assemblyNames.map((a, i) => (i === idx ? asm : a)),
              )
            }}
            fullWidth
          />
          <Tooltip
            title={
              assemblyNames.length <= 2
                ? 'An all-vs-all comparison needs at least 2 assemblies'
                : 'Remove this assembly'
            }
          >
            <span>
              <Button
                size="small"
                disabled={assemblyNames.length <= 2}
                onClick={() => {
                  setAssemblyNames(assemblyNames.filter((_, i) => i !== idx))
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
          setAssemblyNames([...assemblyNames, defaultAsm])
        }}
      >
        Add assembly
      </Button>
    </>
  )
})

export default AllVsAllAddTrackComponent
