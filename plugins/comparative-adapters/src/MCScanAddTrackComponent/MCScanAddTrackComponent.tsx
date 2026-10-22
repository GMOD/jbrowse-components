import { AssemblySelector, FileSelector } from '@jbrowse/core/ui'
import { getSession, useAddTrackFields } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { AddTrackComponentModel, FileLocation } from '@jbrowse/core/util'

interface AnchorsForm {
  bed1Assembly?: string
  bed2Assembly?: string
  bed1Location?: FileLocation
  bed2Location?: FileLocation
}

// The pair goes on the track as well as the adapter: a synteny view only offers
// tracks that cover every assembly it displays (filterTracks), so a track left
// listing just the assembly the widget was opened on never appears in the view
// it was made for.
function contribute(form: AnchorsForm) {
  const { bed1Assembly, bed2Assembly, bed1Location, bed2Location } = form
  const assemblyNames = [bed1Assembly, bed2Assembly]
  return {
    trackConfig: {
      assemblyNames,
      adapter: {
        assemblyNames,
        bed1Location,
        bed2Location,
      },
    },
    missing:
      bed1Location && bed2Location
        ? undefined
        : 'Choose both BED files: the .anchors file names genes, and the BEDs place them',
  }
}

const MCScanAddTrackComponent = observer(function MCScanAddTrackComponent({
  model,
}: {
  model: AddTrackComponentModel
}) {
  const session = getSession(model)
  const defaultAsm = session.assemblies[0]?.name
  const { form, update } = useAddTrackFields<AnchorsForm>(
    model,
    'MCScanAddTrackComponent',
    { bed1Assembly: defaultAsm, bed2Assembly: defaultAsm },
    contribute,
  )

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
        selected={form.bed1Assembly}
        onChange={asm => {
          update({ bed1Assembly: asm })
        }}
        fullWidth
      />
      <AssemblySelector
        session={session}
        label="BED2 assembly"
        helperText=""
        selected={form.bed2Assembly}
        onChange={asm => {
          update({ bed2Assembly: asm })
        }}
        fullWidth
      />
      <FileSelector
        name="BED1"
        inline
        description=""
        location={form.bed1Location}
        setLocation={loc => {
          update({ bed1Location: loc })
        }}
      />
      <FileSelector
        name="BED2"
        inline
        description=""
        location={form.bed2Location}
        setLocation={loc => {
          update({ bed2Location: loc })
        }}
      />
    </div>
  )
})

export default MCScanAddTrackComponent
