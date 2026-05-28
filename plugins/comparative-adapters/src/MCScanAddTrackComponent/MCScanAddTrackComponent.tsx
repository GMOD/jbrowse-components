import { useState } from 'react'

import { AssemblySelector, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { FileLocation } from '@jbrowse/core/util'

interface TrackModel {
  setMixinData: (data: Record<string, unknown>) => void
}

const MCScanAddTrackComponent = observer(function MCScanAddTrackComponent({
  model,
}: {
  model: TrackModel
}) {
  const session = getSession(model)
  const defaultAsm = session.assemblies[0]?.name
  const [r0, setR0] = useState(defaultAsm)
  const [r1, setR1] = useState(defaultAsm)
  const [bed1Location, setBed1Location] = useState<FileLocation>()
  const [bed2Location, setBed2Location] = useState<FileLocation>()
  return (
    <div style={{ marginTop: 20 }}>
      <Typography>
        JBrowse requires the two BED files that specify the genomic locations of
        the genes in the .anchors files
      </Typography>
      <AssemblySelector
        session={session}
        label="BED1 assembly"
        helperText=""
        selected={r0}
        onChange={asm => {
          setR0(asm)
          model.setMixinData({
            adapter: {
              assemblyNames: [asm, r1],
              bed1Location,
              bed2Location,
            },
          })
        }}
        fullWidth
      />
      <AssemblySelector
        session={session}
        label="BED2 assembly"
        helperText=""
        selected={r1}
        onChange={asm => {
          setR1(asm)
          model.setMixinData({
            adapter: {
              assemblyNames: [r0, asm],
              bed1Location,
              bed2Location,
            },
          })
        }}
        fullWidth
      />
      <FileSelector
        name="BED1"
        inline
        description=""
        location={bed1Location}
        setLocation={loc => {
          setBed1Location(loc)
          model.setMixinData({
            adapter: {
              assemblyNames: [r0, r1],
              bed1Location: loc,
              bed2Location,
            },
          })
        }}
      />
      <FileSelector
        name="BED2"
        inline
        description=""
        location={bed2Location}
        setLocation={loc => {
          setBed2Location(loc)
          model.setMixinData({
            adapter: {
              assemblyNames: [r0, r1],
              bed1Location,
              bed2Location: loc,
            },
          })
        }}
      />
    </div>
  )
})

export default MCScanAddTrackComponent
