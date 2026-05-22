import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

interface TrackModel {
  setMixinData: (data: Record<string, unknown>) => void
}

const ComparativeAddTrackComponent = observer(
  function ComparativeAddTrackComponent({ model }: { model: TrackModel }) {
    const session = getSession(model)
    const [queryAssembly, setQueryAssembly] = useState(() => {
      const asm = session.assemblies[0]?.name ?? ''
      model.setMixinData({ adapter: { queryAssembly: asm, targetAssembly: asm } })
      return asm
    })
    const [targetAssembly, setTargetAssembly] = useState(queryAssembly)
    return (
      <>
        <AssemblySelector
          session={session}
          label="Query assembly"
          helperText=""
          selected={queryAssembly}
          onChange={asm => {
            setQueryAssembly(asm)
            model.setMixinData({
              adapter: { queryAssembly: asm, targetAssembly },
            })
          }}
          fullWidth
        />
        <AssemblySelector
          session={session}
          label="Target assembly"
          helperText=""
          selected={targetAssembly}
          onChange={asm => {
            setTargetAssembly(asm)
            model.setMixinData({
              adapter: { queryAssembly, targetAssembly: asm },
            })
          }}
          fullWidth
        />
      </>
    )
  },
)

export default ComparativeAddTrackComponent
