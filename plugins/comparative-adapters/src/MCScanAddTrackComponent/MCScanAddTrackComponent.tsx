import { useState } from 'react'

import { AssemblySelector, FileSelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { useSeedTrackMixin } from '../addTrackMixinContribution.ts'

import type { AddTrackComponentModel } from '../addTrackMixinContribution.ts'
import type { FileLocation } from '@jbrowse/core/util'

interface AnchorsForm {
  bed1Assembly?: string
  bed2Assembly?: string
  bed1Location?: FileLocation
  bed2Location?: FileLocation
}

function formToMixin(form: AnchorsForm) {
  const { bed1Assembly, bed2Assembly, bed1Location, bed2Location } = form
  return {
    adapter: {
      assemblyNames: [bed1Assembly, bed2Assembly],
      bed1Location,
      bed2Location,
    },
  }
}

const MCScanAddTrackComponent = observer(function MCScanAddTrackComponent({
  model,
}: {
  model: AddTrackComponentModel
}) {
  const session = getSession(model)
  const defaultAsm = session.assemblies[0]?.name
  const [form, setForm] = useState<AnchorsForm>({
    bed1Assembly: defaultAsm,
    bed2Assembly: defaultAsm,
  })

  useSeedTrackMixin(model, formToMixin(form))

  function update(patch: Partial<AnchorsForm>) {
    const next = { ...form, ...patch }
    setForm(next)
    model.setMixinData(formToMixin(next))
  }

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
