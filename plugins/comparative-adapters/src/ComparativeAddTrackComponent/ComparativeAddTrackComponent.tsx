import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { useSeedTrackMixin } from '../addTrackMixinContribution.ts'

import type { AddTrackComponentModel } from '../addTrackMixinContribution.ts'

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

    useSeedTrackMixin(model, { adapter: { queryAssembly, targetAssembly } })

    function update(query: string, target: string) {
      setQueryAssembly(query)
      setTargetAssembly(target)
      model.setMixinData({
        adapter: { queryAssembly: query, targetAssembly: target },
      })
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
