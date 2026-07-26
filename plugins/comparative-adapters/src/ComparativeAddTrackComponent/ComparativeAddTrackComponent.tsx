import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { useSeedTrackMixin } from '../addTrackMixinContribution.ts'

import type { AddTrackComponentModel } from '@jbrowse/core/util'

// The pair goes on the track as well as the adapter: a synteny view only offers
// tracks that cover every assembly it displays (filterTracks), so a track left
// listing just the assembly the widget was opened on never appears in the view
// it was made for.
function toMixin(queryAssembly: string, targetAssembly: string) {
  return {
    assemblyNames: [queryAssembly, targetAssembly],
    adapter: { queryAssembly, targetAssembly },
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
    const [queryAssembly, setQueryAssembly] = useState(defaultAsm)
    const [targetAssembly, setTargetAssembly] = useState(defaultAsm)

    useSeedTrackMixin(model, toMixin(queryAssembly, targetAssembly))

    function update(query: string, target: string) {
      setQueryAssembly(query)
      setTargetAssembly(target)
      model.setMixinData(toMixin(query, target))
    }

    return (
      <>
        <AssemblySelector
          session={session}
          label="Query assembly"
          helperText=""
          selected={queryAssembly}
          onChange={asm => {
            update(asm, targetAssembly)
          }}
          fullWidth
        />
        <AssemblySelector
          session={session}
          label="Target assembly"
          helperText=""
          selected={targetAssembly}
          onChange={asm => {
            update(queryAssembly, asm)
          }}
          fullWidth
        />
      </>
    )
  },
)

export default ComparativeAddTrackComponent
