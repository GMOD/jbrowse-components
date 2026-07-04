import { useEffect, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

interface TrackModel {
  setMixinData: (data: Record<string, unknown>) => void
}

// Add-track form for an all-vs-all PAF: the file backs the whole multi-way
// comparison, so a single track just picks the pair it draws. assemblyNameToPanSN
// is left at its identity default (assembly name === PanSN sample prefix); a
// mismatch is rare enough to configure by hand in the config editor.
const AllVsAllAddTrackComponent = observer(function AllVsAllAddTrackComponent({
  model,
}: {
  model: TrackModel
}) {
  const session = getSession(model)
  const defaultAsm = session.assemblies[0]?.name ?? ''
  const [assembly1, setAssembly1] = useState(defaultAsm)
  const [assembly2, setAssembly2] = useState(session.assemblies[1]?.name ?? '')

  useEffect(() => {
    model.setMixinData({ adapter: { assemblyNames: [assembly1, assembly2] } })
    return () => {
      try {
        model.setMixinData({})
      } catch {
        // widget may already be detached during teardown (submit); ignore
      }
    }
  }, [model, assembly1, assembly2])

  return (
    <>
      <Typography>
        An all-vs-all PAF contains every pairwise alignment. Choose the two
        assemblies this track should draw; the sequence names must be
        PanSN-prefixed with their assembly (e.g. <code>grape#1#chr1</code>).
      </Typography>
      <AssemblySelector
        session={session}
        label="Assembly 1"
        helperText=""
        selected={assembly1}
        onChange={asm => {
          setAssembly1(asm)
        }}
        fullWidth
      />
      <AssemblySelector
        session={session}
        label="Assembly 2"
        helperText=""
        selected={assembly2}
        onChange={asm => {
          setAssembly2(asm)
        }}
        fullWidth
      />
    </>
  )
})

export default AllVsAllAddTrackComponent
