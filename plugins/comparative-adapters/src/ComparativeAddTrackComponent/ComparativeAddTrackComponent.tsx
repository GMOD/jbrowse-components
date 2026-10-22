import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession, useAddTrackFields } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { AddTrackComponentModel } from '@jbrowse/core/util'

interface PairForm {
  queryAssembly: string
  targetAssembly: string
}

// The pair goes on the track as well as the adapter: a synteny view only offers
// tracks that cover every assembly it displays (filterTracks), so a track left
// listing just the assembly the widget was opened on never appears in the view
// it was made for.
function contribute({ queryAssembly, targetAssembly }: PairForm) {
  return {
    trackConfig: {
      assemblyNames: [queryAssembly, targetAssembly],
      adapter: { queryAssembly, targetAssembly },
    },
  }
}

const ComparativeAddTrackComponent = observer(
  function ComparativeAddTrackComponent({
    model,
  }: {
    model: AddTrackComponentModel
  }) {
    const session = getSession(model)
    const defaultAsm = session.assemblies[0]?.name ?? ''
    const { form, update } = useAddTrackFields(
      model,
      'ComparativeAddTrackComponent',
      { queryAssembly: defaultAsm, targetAssembly: defaultAsm },
      contribute,
    )

    return (
      <>
        <AssemblySelector
          session={session}
          label="Query assembly"
          helperText=""
          selected={form.queryAssembly}
          onChange={asm => {
            update({ queryAssembly: asm })
          }}
          fullWidth
        />
        <AssemblySelector
          session={session}
          label="Target assembly"
          helperText=""
          selected={form.targetAssembly}
          onChange={asm => {
            update({ targetAssembly: asm })
          }}
          fullWidth
        />
      </>
    )
  },
)

export default ComparativeAddTrackComponent
