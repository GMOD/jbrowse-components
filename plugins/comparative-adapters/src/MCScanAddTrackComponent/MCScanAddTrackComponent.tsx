import { useEffect, useState } from 'react'

import { AssemblySelector, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { FileLocation } from '@jbrowse/core/util'

const MCScanAddTrackComponent = observer(function MCScanAddTrackComponent({
  model,
}: any) {
  const session = getSession(model)
  const [r0, setR0] = useState(session.assemblies[0]?.name)
  const [r1, setR1] = useState(session.assemblies[0]?.name)
  const [bed1Location, setBed1Location] = useState<FileLocation>()
  const [bed2Location, setBed2Location] = useState<FileLocation>()
  useEffect(() => {
    model.setMixinData({
      adapter: {
        assemblyNamees: [r0, r1],
        bed1Location,
        bed2Location,
      },
    })
  }, [model, bed1Location, bed2Location, r0, r1])
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
        }}
        TextFieldProps={{
          fullWidth: true,
        }}
      />
      <AssemblySelector
        session={session}
        label="BED2 assembly"
        helperText=""
        selected={r1}
        onChange={asm => {
          setR1(asm)
        }}
        TextFieldProps={{
          fullWidth: true,
        }}
      />
      <FileSelector
        name="BED1"
        inline
        description=""
        location={bed1Location}
        setLocation={loc => {
          setBed1Location(loc)
        }}
      />
      <FileSelector
        name="BED2"
        inline
        description=""
        location={bed2Location}
        setLocation={loc => {
          setBed2Location(loc)
        }}
      />
    </div>
  )
})

export default MCScanAddTrackComponent
